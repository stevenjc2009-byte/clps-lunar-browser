// Verdict rules (docs/VERDICT.md). A pure function: same inputs, same badges, stars and
// sentences. Every sentence is generated from the rule that fired, so the text on the
// page is always true for the numbers on the page.
//
// Works for any number of sites; nothing here knows site ids.

import { fmtDuration, listAnd } from './format'
import { SYNODIC_MONTH_H, type Censor } from './windowMetrics'

export type Badge = 'energy' | 'comms' | 'night' | 'balanced'
export const BADGES: Badge[] = ['energy', 'comms', 'night', 'balanced']
export const BADGE_TEXT: Record<Badge, string> = {
  energy: 'Best for energy',
  comms: 'Best for communication',
  night: 'Shortest night',
  balanced: 'Balanced',
}

// Spec 6.4 wording, shown on every flat-horizon card and in the verdict.
export const FLAT_WARNING = 'Terrain data not loaded: flat-horizon approximation, not reliable for ranking.'

export const ENERGY_MARGIN_PTS = 2
export const COMMS_MARGIN_PTS = 2
export const NIGHT_MARGIN_H = 24
export const BALANCED_MARGIN_PTS = 2
// Absolute floor: a site is only "Balanced" if its worst-case score is at least this, so a
// site that is merely the least bad of poor options (e.g. 11% Sun, 12% link) is not praised.
export const BALANCED_FLOOR = 25
// Night score reference: 100 = no night, 0 = a night one whole lunar month long (or longer).
export const NIGHT_REF_H = SYNODIC_MONTH_H

export interface VerdictInput {
  id: string
  name: string
  sunPct: number                         // already rounded to 0.1 as shown
  commsPct: number                       // link % (or Earth % when DSN is off / missing)
  dark: { hours: number; status: Censor }
  terrain: boolean
}

export type RuleState = 'winner' | 'comparable' | 'undetermined' | 'below_floor' | 'single'

export interface RuleOutcome {
  rule: Badge
  state: RuleState
  winner: string | null
  group: string[]      // comparable: sites within the margin of the leader; undetermined: the sites blocking a call
  sentence: string
}

export interface Verdict {
  outcomes: Record<Badge, RuleOutcome>
  badges: Record<string, Badge[]>
  stars: { sun: string | null; comms: string | null; dark: string | null }
  cardState: Record<string, 'badged' | 'close' | 'none'>
  scores: Record<string, { night: number; worst: number }>   // 0..100, fixed reference ranges
  provisional: boolean
  provisionalSites: string[]
  sentences: string[]
}

const round1 = (x: number) => Math.round(x * 10) / 10
const pct = (v: number) => `${v.toFixed(1)}%`

// Night score on the fixed 0..100 scale. A night known only as "at least" scores 0: the
// Balanced rule is a worst-case rule, and that night could be any length.
export function nightScore(dark: { hours: number; status: Censor }): number {
  if (dark.status !== 'exact') return 0
  return round1(100 * (1 - Math.min(1, Math.max(0, dark.hours / NIGHT_REF_H))))
}

export function worstCaseScore(s: VerdictInput): number {
  return round1(Math.min(s.sunPct, s.commsPct, nightScore(s.dark)))
}

// Highest value wins if it leads the runner-up by at least `margin` (compared on the
// 0.1-rounded values that are shown). Otherwise everything within the margin is "comparable".
function maxRule(rows: VerdictInput[], value: (r: VerdictInput) => number, margin: number) {
  const sorted = [...rows].sort((a, b) => value(b) - value(a))
  const top = value(sorted[0]), next = value(sorted[1])
  if (round1(top - next) >= margin) return { winner: sorted[0], runner: sorted[1], group: [] as VerdictInput[] }
  return { winner: null, runner: sorted[1], group: sorted.filter(r => round1(top - value(r)) < margin) }
}

const names = (rows: VerdictInput[], show: (r: VerdictInput) => string) => listAnd(rows.map(r => `${r.name} ${show(r)}`))

function single(rule: Badge): RuleOutcome {
  return { rule, state: 'single', winner: null, group: [], sentence: 'Pick at least two sites to compare.' }
}

function energyRule(rows: VerdictInput[]): RuleOutcome {
  const r = maxRule(rows, x => x.sunPct, ENERGY_MARGIN_PTS)
  if (r.winner) {
    const lead = round1(r.winner.sunPct - r.runner.sunPct).toFixed(1)
    return { rule: 'energy', state: 'winner', winner: r.winner.id, group: [],
      sentence: `Best for energy: ${r.winner.name} has the Sun up ${pct(r.winner.sunPct)} of the time, ${lead} points more than the next site, ${r.runner.name} (${pct(r.runner.sunPct)}). This label needs a lead of at least ${ENERGY_MARGIN_PTS} points.` }
  }
  return { rule: 'energy', state: 'comparable', winner: null, group: r.group.map(x => x.id),
    sentence: `Energy: too close to call. ${names(r.group, x => pct(x.sunPct))} are less than ${ENERGY_MARGIN_PTS} points apart, so no site is named best for energy.` }
}

function commsRule(rows: VerdictInput[], kind: 'link' | 'earth'): RuleOutcome {
  const what = kind === 'link' ? 'a radio link home (Earth in view and a Deep Space Network dish able to see the Moon)' : 'Earth in view'
  const r = maxRule(rows, x => x.commsPct, COMMS_MARGIN_PTS)
  if (r.winner) {
    const lead = round1(r.winner.commsPct - r.runner.commsPct).toFixed(1)
    return { rule: 'comms', state: 'winner', winner: r.winner.id, group: [],
      sentence: `Best for communication: ${r.winner.name} has ${what} ${pct(r.winner.commsPct)} of the time, ${lead} points more than the next site, ${r.runner.name} (${pct(r.runner.commsPct)}). This label needs a lead of at least ${COMMS_MARGIN_PTS} points.` }
  }
  return { rule: 'comms', state: 'comparable', winner: null, group: r.group.map(x => x.id),
    sentence: `Communication: too close to call. ${names(r.group, x => pct(x.commsPct))} are less than ${COMMS_MARGIN_PTS} points apart, so no site is named best for communication.` }
}

// Shortest night: only exact nights can win. A night known only as "at least N" blocks
// the call when N is not at least a day longer than the leader (its real night might be shorter).
function nightRule(rows: VerdictInput[]): RuleOutcome {
  const exact = rows.filter(r => r.dark.status === 'exact').sort((a, b) => a.dark.hours - b.dark.hours)
  const censored = rows.filter(r => r.dark.status !== 'exact')
  const showDark = (r: VerdictInput) => (r.dark.status === 'exact' ? fmtDuration(r.dark.hours) : `at least ${fmtDuration(r.dark.hours)}`)
  if (!exact.length) {
    return { rule: 'night', state: 'undetermined', winner: null, group: censored.map(r => r.id),
      sentence: 'Shortest night: cannot call. Every site\'s longest night runs past the edge of our data, so none of them is known in full.' }
  }
  const w = exact[0]
  const closeExact = exact.filter(r => r.dark.hours - w.dark.hours < NIGHT_MARGIN_H)
  const blockers = censored.filter(r => r.dark.hours - w.dark.hours < NIGHT_MARGIN_H)
  const blockText = blockers.length
    ? ` ${names(blockers, showDark)} ${blockers.length > 1 ? 'run' : 'runs'} past the edge of our data, so ${blockers.length > 1 ? 'their' : 'its'} real night could be shorter.`
    : ''
  if (closeExact.length > 1) {
    return { rule: 'night', state: 'comparable', winner: null, group: closeExact.map(r => r.id),
      sentence: `Shortest night: too close to call. ${names(closeExact, showDark)} are less than 1 day apart.${blockText}` }
  }
  if (blockers.length) {
    return { rule: 'night', state: 'undetermined', winner: null, group: blockers.map(r => r.id),
      sentence: `Shortest night: cannot call. ${w.name}'s longest night is ${fmtDuration(w.dark.hours)}, but${blockText}` }
  }
  const others = rows.filter(r => r.id !== w.id).sort((a, b) => a.dark.hours - b.dark.hours)
  const runner = others[0]
  return { rule: 'night', state: 'winner', winner: w.id, group: [],
    sentence: `Shortest night: ${w.name}'s longest night is ${fmtDuration(w.dark.hours)}, at least 1 day shorter than every other site's (next: ${runner.name}, ${showDark(runner)}).` }
}

function balancedRule(rows: VerdictInput[], kind: 'link' | 'earth'): RuleOutcome {
  const commsName = kind === 'link' ? 'link' : 'Earth'
  const r = maxRule(rows, worstCaseScore, BALANCED_MARGIN_PTS)
  const how = `the lowest of its Sun %, ${commsName} % and night score (100 = no night, 0 = a night a whole lunar month long; a night known only as "at least" scores 0)`
  const best = Math.max(...rows.map(worstCaseScore))
  if (best < BALANCED_FLOOR) {
    return { rule: 'balanced', state: 'below_floor', winner: null, group: [],
      sentence: `Balanced: no site qualifies. The best worst-case score is ${best.toFixed(1)} out of 100, below the ${BALANCED_FLOOR} needed. A site's worst-case score is ${how}.` }
  }
  if (r.winner) {
    return { rule: 'balanced', state: 'winner', winner: r.winner.id, group: [],
      sentence: `Balanced: ${r.winner.name} has the best worst-case score, ${worstCaseScore(r.winner).toFixed(1)} out of 100, at least ${BALANCED_MARGIN_PTS} points above the next site, ${r.runner.name} (${worstCaseScore(r.runner).toFixed(1)}). A site's worst-case score is ${how}.` }
  }
  return { rule: 'balanced', state: 'comparable', winner: null, group: r.group.map(x => x.id),
    sentence: `Balanced: too close to call. ${names(r.group, x => worstCaseScore(x).toFixed(1))} have worst-case scores less than ${BALANCED_MARGIN_PTS} points apart. A site's worst-case score is ${how}.` }
}

export function verdict(rows: VerdictInput[], commsKind: 'link' | 'earth' = 'link'): Verdict {
  const scores = Object.fromEntries(rows.map(r => [r.id, { night: nightScore(r.dark), worst: worstCaseScore(r) }]))
  const provisionalSites = rows.filter(r => !r.terrain).map(r => r.id)
  const provisional = provisionalSites.length > 0
  const outcomes: Record<Badge, RuleOutcome> = rows.length < 2
    ? { energy: single('energy'), comms: single('comms'), night: single('night'), balanced: single('balanced') }
    : { energy: energyRule(rows), comms: commsRule(rows, commsKind), night: nightRule(rows), balanced: balancedRule(rows, commsKind) }

  const badges: Record<string, Badge[]> = Object.fromEntries(rows.map(r => [r.id, BADGES.filter(b => outcomes[b].winner === r.id)]))
  const inGroup = (id: string) => BADGES.some(b => outcomes[b].group.includes(id))
  const cardState = Object.fromEntries(rows.map(r => [r.id,
    badges[r.id].length ? 'badged' : inGroup(r.id) ? 'close' : 'none'] as const))
  // Stars mark exactly the rule winners on their own row, so a star never sits on a card
  // that has no badge, and a "too close" row never has a star.
  const stars = { sun: outcomes.energy.winner, comms: outcomes.comms.winner, dark: outcomes.night.winner }

  const sentences = rows.length < 2 ? [outcomes.energy.sentence] : BADGES.map(b => outcomes[b].sentence)
  if (provisional) {
    const flat = listAnd(rows.filter(r => !r.terrain).map(r => r.name))
    sentences.push(`Provisional. ${flat}: ${FLAT_WARNING} So every badge and star here is provisional.`)
  }
  return { outcomes, badges, stars, cardState, scores, provisional, provisionalSites, sentences }
}
