import { describe, expect, it } from 'vitest'
import {
  BALANCED_FLOOR, nightScore, verdict, worstCaseScore, type Badge, type RuleState, type VerdictInput,
} from './verdict'

const D = 24
function s(id: string, sunPct: number, commsPct: number, darkH: number, censored = false, terrain = true): VerdictInput {
  return { id, name: id.toUpperCase(), sunPct, commsPct, dark: { hours: darkH, status: censored ? 'at_least' : 'exact' }, terrain }
}

type Want = Partial<Record<Badge, [RuleState, string | null]>>
interface Case { name: string; rows: VerdictInput[]; want: Want; provisional?: boolean }

// The snapshot table mirrored in docs/VERDICT.md. Each row pins the state and winner of every rule it names.
export const CASES: Case[] = [
  { name: 'clear winners on every rule',
    rows: [s('a', 80, 30, 5 * D), s('b', 40, 90, 12 * D), s('c', 60, 60, 2 * D)],
    want: { energy: ['winner', 'a'], comms: ['winner', 'b'], night: ['winner', 'c'], balanced: ['winner', 'c'] } },
  { name: 'near-tie on Sun (1.9 pts) -> comparable',
    rows: [s('a', 52.0, 30, 5 * D), s('b', 50.1, 90, 12 * D)],
    want: { energy: ['comparable', null] } },
  { name: 'lead of exactly 2.0 pts counts',
    rows: [s('a', 52.1, 30, 5 * D), s('b', 50.1, 90, 12 * D)],
    want: { energy: ['winner', 'a'] } },
  { name: 'exact tie on comms -> comparable',
    rows: [s('a', 80, 70, 5 * D), s('b', 40, 70, 12 * D)],
    want: { comms: ['comparable', null] } },
  { name: 'night: exact vs exact, 1 day apart -> winner',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 11 * D)],
    want: { night: ['winner', 'a'] } },
  { name: 'night: exact vs exact, 23 h apart -> comparable',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 10 * D + 23)],
    want: { night: ['comparable', null] } },
  { name: 'night: exact tie -> comparable',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 10 * D)],
    want: { night: ['comparable', null] } },
  { name: 'night: exact vs censored, censored bound already >= 1 day longer -> exact wins, censored simply loses',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 12 * D, true)],
    want: { night: ['winner', 'a'] } },
  { name: 'night: exact vs censored shorter bound -> cannot call (its real night might be shorter)',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 17, true)],
    want: { night: ['undetermined', null] } },
  { name: 'night: exact vs censored bound within 1 day -> cannot call',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 10 * D + 5, true)],
    want: { night: ['undetermined', null] } },
  { name: 'night: censored vs censored -> cannot call',
    rows: [s('a', 50, 50, 10 * D, true), s('b', 50, 50, 30 * D, true)],
    want: { night: ['undetermined', null] } },
  { name: 'night: two exact close + one censored blocker -> comparable',
    rows: [s('a', 50, 50, 10 * D), s('b', 50, 50, 10 * D + 3), s('c', 50, 50, 2, true)],
    want: { night: ['comparable', null] } },
  { name: 'single site -> every rule "single", no badges',
    rows: [s('a', 90, 90, 1)],
    want: { energy: ['single', null], comms: ['single', null], night: ['single', null], balanced: ['single', null] } },
  { name: 'balanced: poor sites stay below the floor (audit B2)',
    rows: [s('a', 10, 90, 5 * D), s('b', 11, 12, 5 * D), s('c', 30, 14, 5 * D)],
    want: { balanced: ['below_floor', null] } },
  { name: 'balanced: censored night scores 0 in the worst case',
    rows: [s('a', 60, 60, 2 * D, true), s('b', 55, 55, 10 * D)],
    want: { balanced: ['winner', 'b'] } },
  { name: 'all flat -> provisional, badges still computed',
    rows: [s('a', 80, 30, 5 * D, false, false), s('b', 40, 90, 12 * D, false, false)],
    want: { energy: ['winner', 'a'], comms: ['winner', 'b'] }, provisional: true },
  { name: 'seven sites, six within 2 pts on Sun -> one comparable group of six',
    rows: [s('a', 50, 50, 10 * D), s('b', 49.5, 50, 10 * D), s('c', 49, 50, 10 * D), s('d', 48.6, 50, 10 * D),
      s('e', 48.5, 50, 10 * D), s('f', 48.1, 50, 10 * D), s('g', 20, 10, 20 * D)],
    want: { energy: ['comparable', null] } },
]

describe('verdict snapshot table', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const v = verdict(c.rows)
      for (const [rule, [state, winner]] of Object.entries(c.want) as [Badge, [RuleState, string | null]][]) {
        expect(v.outcomes[rule].state, rule).toBe(state)
        expect(v.outcomes[rule].winner, rule).toBe(winner)
      }
      expect(v.provisional).toBe(!!c.provisional)
    })
  }
})

describe('verdict consistency', () => {
  it('stars are exactly the rule winners, so a starred card always has a badge', () => {
    for (const c of CASES) {
      const v = verdict(c.rows)
      for (const id of [v.stars.sun, v.stars.comms, v.stars.dark]) {
        if (id) expect(v.cardState[id]).toBe('badged')
      }
      for (const r of c.rows) {
        if (v.cardState[r.id] !== 'badged') {
          expect([v.stars.sun, v.stars.comms, v.stars.dark]).not.toContain(r.id)
        }
      }
    }
  })
  it('a censored night never gets the darkness star', () => {
    for (const c of CASES) {
      const v = verdict(c.rows)
      const starred = c.rows.find(r => r.id === v.stars.dark)
      if (starred) expect(starred.dark.status).toBe('exact')
    }
  })
  it('every comparable group lists the sites inside the margin, and the sentence names them all', () => {
    const v = verdict(CASES[CASES.length - 1].rows)
    expect(v.outcomes.energy.group).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F']) expect(v.outcomes.energy.sentence).toContain(n)
    expect(v.outcomes.energy.sentence).not.toContain('G ')
    expect(v.cardState.g).toBe('none')
    expect(v.cardState.a).not.toBe('none')
  })
  it('sentences quote the numbers that decided the rule', () => {
    const v = verdict(CASES[0].rows)
    expect(v.outcomes.energy.sentence).toContain('80.0%')
    expect(v.outcomes.energy.sentence).toContain('20.0 points')
    expect(v.outcomes.night.sentence).toContain('2.0 days')
    expect(v.sentences).toHaveLength(4)
  })
  it('provisional adds a sentence naming the flat-horizon sites', () => {
    const v = verdict([s('a', 80, 30, 5 * D), s('b', 40, 90, 12 * D, false, false)])
    expect(v.provisional).toBe(true)
    expect(v.provisionalSites).toEqual(['b'])
    expect(v.sentences[v.sentences.length - 1]).toMatch(/^Provisional\. B: Terrain data not loaded: flat-horizon approximation, not reliable for ranking\./)
  })
  it('comms wording follows the comms kind', () => {
    const rows = CASES[0].rows
    expect(verdict(rows, 'link').outcomes.comms.sentence).toMatch(/Deep Space Network/)
    expect(verdict(rows, 'earth').outcomes.comms.sentence).not.toMatch(/Deep Space Network/)
  })
})

describe('fixed-reference normalisation', () => {
  it('a site\'s scores do not depend on which other sites are compared', () => {
    const a = s('a', 60, 70, 5 * D)
    const v1 = verdict([a, s('b', 10, 10, 1)]), v2 = verdict([a, s('c', 99, 99, 600)])
    expect(v1.scores.a).toEqual(v2.scores.a)
  })
  it('removing a site outside every winner/comparable group leaves every outcome unchanged', () => {
    const rows = [s('a', 80, 30, 5 * D), s('b', 40, 90, 12 * D), s('c', 60, 60, 2 * D), s('d', 5, 5, 20 * D)]
    const full = verdict(rows), less = verdict(rows.slice(0, 3))
    for (const b of ['energy', 'comms', 'night', 'balanced'] as Badge[]) {
      expect(less.outcomes[b].winner).toBe(full.outcomes[b].winner)
      expect(less.outcomes[b].state).toBe(full.outcomes[b].state)
    }
  })
  it('night score: 100 for no night, 0 for a lunar month or more, 0 when censored', () => {
    expect(nightScore({ hours: 0, status: 'exact' })).toBe(100)
    expect(nightScore({ hours: 29.530589 * 24, status: 'exact' })).toBe(0)
    expect(nightScore({ hours: 2000, status: 'exact' })).toBe(0)
    expect(nightScore({ hours: 1, status: 'at_least' })).toBe(0)
    expect(worstCaseScore(s('x', 40, 90, 0))).toBe(40)
    expect(BALANCED_FLOOR).toBe(25)
  })
})
