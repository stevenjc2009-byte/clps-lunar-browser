import { useEffect, useState } from 'react'
import Explain from './Explain'
import { fmtDuration, listAnd } from './lib/format'
import { paramsKey, type Params } from './lib/params'
import type { Site } from './types'
import type { EngineClient } from './worker/client'
import type { SensCell, SensGroup, SensRow, Variant, Win } from './worker/compute'
import './controls.css'

const SENS_EXPLAIN = {
  intro: 'Every number on this page comes from a model, and some of its settings nobody knows exactly: how high the real skyline is, how high the lander stands, when Earth counts as "in view". This table changes one setting at a time, keeps the others as they are now, and shows how the numbers move. If a number moves a lot between rows, do not trust it to the exact figure.',
  slow: 'Why can the longest night jump by many hours? Near Shackleton the Sun crosses the skyline very slowly, only about 0.01° an hour, so a skyline just 0.1° higher moves a sunrise by about 10 hours. Watch the "Night" figures in the safety-margin rows.',
  verdict: '"Energy pick changes" or "Comms pick changes" marks a row where the "Best for energy" or "Best for communication" label would go to a different site (or become "too close to call") compared with the settings you have now.',
}

const GROUP_LABEL: Record<SensGroup, string> = {
  mask: 'Horizon safety margin', height: 'Lander height', earth: 'Earth counts as in view when', dsn: 'Lowest DSN dish angle',
}
const EARTH_LABEL: Record<string, string> = { centre: 'Centre', any_part: 'Any part', whole_disc: 'Whole disc' }
const GROUPS: SensGroup[] = ['mask', 'height', 'earth', 'dsn']

function valueLabel(v: Variant): string {
  if (v.group === 'earth') return EARTH_LABEL[String(v.value)] ?? String(v.value)
  return v.group === 'height' ? `${v.value} m` : `${v.value}°`
}

const night = (c: SensCell) => `${c.darkStatus === 'at_least' ? '≥ ' : ''}${fmtDuration(c.darkHours)}`

function Cell({ c }: { c: SensCell }) {
  return (
    <td>
      <span className="sens-sun">Sun {c.sunPct.toFixed(1)}%</span>
      <span className="sens-link">{c.commsKind === 'link' ? 'Link' : 'Earth'} {c.linkPct.toFixed(1)}%</span>
      <span className="sens-night">Night {night(c)}</span>
    </td>
  )
}

// One sentence per site: the lowest and highest values seen across the rows.
function spread(rows: SensRow[], sites: Site[]): string[] {
  return sites.map((s, i) => {
    const cells = rows.map(r => r.cells[i])
    const sun = cells.map(c => c.sunPct)
    const byDark = [...cells].sort((a, b) => a.darkHours - b.darkHours)
    return `${s.name}: Sun ${Math.min(...sun).toFixed(1)}% to ${Math.max(...sun).toFixed(1)}%, longest night ${night(byDark[0])} to ${night(byDark[byDark.length - 1])}.`
  })
}

interface SensState { key: string; rows: SensRow[]; done: number; total: number; error: string | null }
const EMPTY: SensState = { key: '', rows: [], done: 0, total: 0, error: null }

export interface SensitivityProps {
  client: EngineClient | null
  sites: Site[]          // the compared sites, in card order
  params: Params         // the settings in use now (the baseline)
  win: Win               // the picked window (hours from the first sample)
  explainAll: boolean
}

// "How sure are these numbers?": computed only while the section is open.
export default function Sensitivity({ client, sites, params, win, explainAll }: SensitivityProps) {
  const [open, setOpen] = useState(false)
  const key = `${sites.map(s => `${s.id}@${s.lat},${s.lon}`).join(',')}|${paramsKey(params)}|${win.startH}|${win.lenH}`
  // Results are tagged with the request they belong to; anything for an older key is ignored.
  const [res, setRes] = useState<SensState>(EMPTY)

  useEffect(() => {
    if (!open || !client || sites.length === 0) return
    const upd = (f: (r: SensState) => SensState) => setRes(r => f(r.key === key ? r : { ...EMPTY, key }))
    return client.sensitivity(sites, params, win, {
      onRow: (row, done, total) => upd(r => ({ ...r, rows: [...r.rows, row], done, total })),
      onDone: () => {},
      onError: m => upd(r => ({ ...r, error: m })),
    })
    // `key` covers sites, params and win.
  }, [open, client, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = res.key === key ? res : { ...EMPTY, key }
  const { rows, error } = cur
  const progress = { done: cur.done, total: cur.total }

  const base = rows.find(r => r.variant.current)
  // Which labels move under this row: [] when none (or before the "now" row arrives).
  const moved = (r: SensRow) => (base ? [
    ...(r.picks.energy !== base.picks.energy ? ['Energy'] : []), ...(r.picks.comms !== base.picks.comms ? ['Comms'] : []),
  ] : [])
  const changed = (r: SensRow) => moved(r).length > 0
  const flips = rows.filter(changed).map(r => `${GROUP_LABEL[r.variant.group].toLowerCase()} ${valueLabel(r.variant)}`)
  const finished = progress.total > 0 && progress.done === progress.total

  return (
    <details className="sens" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
      <summary><h2>How sure are these numbers?</h2></summary>
      <p className="how-read">{SENS_EXPLAIN.intro}</p>
      <p className="how-read">{SENS_EXPLAIN.slow}</p>
      {error && <p className="error" role="alert">Could not work out the table: {error}</p>}
      {!finished && !error && <p className="sens-progress" role="status">
        Working it out… {progress.total ? `${progress.done} of ${progress.total} settings done` : ''}</p>}
      {finished && base && (
        <p className="sens-summary" role="status">
          {flips.length === 0
            ? 'The "Best for energy" and "Best for communication" labels stay the same in every case tested.'
            : `The best pick changes with: ${listAnd(flips)}.`}
          <Explain term="Best pick changes" all={explainAll}>{SENS_EXPLAIN.verdict}</Explain>
        </p>
      )}
      {finished && <ul className="sens-spread">{spread(rows, sites).map(t => <li key={t}>{t}</li>)}</ul>}
      {rows.length > 0 && (
        <div className="sens-scroll" tabIndex={0} role="region" aria-label="Sensitivity table">
          <table className="sens-table">
            <thead>
              <tr><th scope="col">Setting tried</th>{sites.map(s => <th key={s.id} scope="col">{s.name}</th>)}</tr>
            </thead>
            {GROUPS.map(g => {
              const rs = rows.filter(r => r.variant.group === g)
              if (rs.length === 0) return null
              return (
                <tbody key={g}>
                  <tr className="sens-group"><th colSpan={sites.length + 1} scope="colgroup">{GROUP_LABEL[g]}</th></tr>
                  {rs.map(r => (
                    <tr key={`${g}-${r.variant.value}`} className={r.variant.current ? 'sens-now' : ''}>
                      <th scope="row">{valueLabel(r.variant)}{r.variant.current && <span className="sens-tag"> now</span>}
                        {changed(r) && <span className="sens-flip"> {moved(r).join(' and ')} pick changes</span>}</th>
                      {r.cells.map((c, i) => <Cell key={sites[i]?.id ?? i} c={c} />)}
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
      {!params.dsnOn && <p className="how-read">The DSN dish angle is not tried because the DSN switch is off.</p>}
    </details>
  )
}
