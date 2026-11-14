import { useState, type ReactNode } from 'react'
import Explain from './Explain'
import { DEFAULT_PARAMS, DSN_EL_CHOICES_DEG, HEIGHT_CHOICES_M, MASK_OFFSET_CHOICES_DEG, type Params } from './lib/params'
import type { EarthRule } from './lib/visibility'
import './controls.css'

// Plain-language notes for the model settings, written for a school student.
const CONTROL_EXPLAIN = {
  height: 'How high the lander\'s solar panels and radio antenna sit above the ground. From higher up you can see a little further over nearby bumps, so the Sun and Earth stay in view a bit longer. With terrain data each height has its own skyline; without it, height only lowers the flat horizon very slightly for the curve of the Moon. The default is 2 m.',
  mask: 'A safety margin: we pretend the skyline is this many degrees higher in every direction. Use it to see how much the answers depend on hills the map might miss, or on parts of the lander blocking the view. 0° means no margin (the default). Near the south pole the Sun only skims the horizon, so even 3° can remove a lot of sunlight.',
  earth: 'When does Earth count as "in view"? Centre: the middle of Earth\'s disc is above the skyline (the default). Any part: even a sliver of Earth showing counts. Whole disc: all of Earth must be clear of the skyline. Earth looks about 2° wide from the Moon, so this matters when Earth sits on the horizon.',
  dsn: 'A radio link home needs two things: the lander must see Earth, and one of NASA\'s Deep Space Network (DSN) dishes, in California, Spain or Australia, must see the Moon. On (the default) counts only times when both are true. Off counts all the time Earth is in view. Real links also need booked dish time and a strong enough signal, which this page does not model.',
  dsnEl: 'How high the Moon must be above a DSN dish\'s own horizon before that dish can use it. Dishes avoid aiming very low, where the signal crosses more air and nearby ground. The default is 10°.',
  share: 'Copies a link to this exact view: the landing date, look-ahead, sites, sky-graph site, these settings and your own location if you added one. Anyone opening it sees the same numbers.',
}

const EARTH_LABEL: Record<EarthRule, string> = { centre: 'Centre', any_part: 'Any part', whole_disc: 'Whole disc' }
const EARTH_RULES: EarthRule[] = ['centre', 'any_part', 'whole_disc']

interface SegProps<T> {
  label: string
  values: readonly T[]
  current: T
  show: (v: T) => string
  onPick: (v: T) => void
  disabled?: boolean
}

function Seg<T extends string | number | boolean>({ label, values, current, show, onPick, disabled }: SegProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {values.map(v => (
        <button key={String(v)} type="button" aria-pressed={v === current} disabled={disabled}
          className={v === current ? 'active' : ''} onClick={() => onPick(v)}>{show(v)}</button>
      ))}
    </div>
  )
}

function Field({ title, note, children }: { title: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <span>{title}</span>
      {children}
      {note && <span className="ctl-note">{note}</span>}
    </div>
  )
}

export interface ControlsProps {
  params: Params
  onChange: (p: Params) => void
  explainAll: boolean
  dsnLoaded: boolean      // false = sky.json has no DSN data, so the link switch cannot work
  busy?: boolean          // numbers are being recomputed
}

// The model settings (spec 6.2). Every choice is one of the engine's tested values.
export default function Controls({ params, onChange, explainAll, dsnLoaded, busy }: ControlsProps) {
  const set = <K extends keyof Params>(k: K, v: Params[K]) => onChange({ ...params, [k]: v })
  return (
    <div className="ctl-grid">
      <Field title={<>Lander height <Explain term="Lander height" all={explainAll}>{CONTROL_EXPLAIN.height}</Explain></>}>
        <Seg label="Lander height" values={HEIGHT_CHOICES_M} current={params.observerHeightM}
          show={v => `${v} m`} onPick={v => set('observerHeightM', v)} />
      </Field>
      <Field title={<>Horizon safety margin <Explain term="Horizon safety margin" all={explainAll}>{CONTROL_EXPLAIN.mask}</Explain></>}>
        <Seg label="Horizon safety margin" values={MASK_OFFSET_CHOICES_DEG} current={params.maskOffsetDeg}
          show={v => `${v}°`} onPick={v => set('maskOffsetDeg', v)} />
      </Field>
      <Field title={<>Earth counts as in view when <Explain term="Earth in view" all={explainAll}>{CONTROL_EXPLAIN.earth}</Explain></>}>
        <Seg label="Earth counts as in view when" values={EARTH_RULES} current={params.earthRule}
          show={v => EARTH_LABEL[v]} onPick={v => set('earthRule', v)} />
      </Field>
      <Field title={<>Radio link needs a DSN dish <Explain term="DSN dish" all={explainAll}>{CONTROL_EXPLAIN.dsn}</Explain></>}
        note={dsnLoaded ? null : 'DSN data not loaded: the link figure counts Earth in view only.'}>
        <Seg label="Radio link needs a DSN dish" values={[true, false]} current={params.dsnOn && dsnLoaded}
          show={v => (v ? 'On' : 'Off')} onPick={v => set('dsnOn', v)} disabled={!dsnLoaded} />
      </Field>
      <Field title={<>Lowest DSN dish angle <Explain term="Lowest DSN dish angle" all={explainAll}>{CONTROL_EXPLAIN.dsnEl}</Explain></>}
        note={params.dsnOn && dsnLoaded ? null : 'Only used when the DSN switch is on.'}>
        <Seg label="Lowest DSN dish angle" values={DSN_EL_CHOICES_DEG} current={params.dsnMinElDeg}
          show={v => `${v}°`} onPick={v => set('dsnMinElDeg', v)} disabled={!params.dsnOn || !dsnLoaded} />
      </Field>
      <p className="ctl-defaults" role="status">
        {busy ? 'Working out the new numbers…'
          : `Defaults: ${DEFAULT_PARAMS.observerHeightM} m, ${DEFAULT_PARAMS.maskOffsetDeg}° margin, Earth ${EARTH_LABEL[DEFAULT_PARAMS.earthRule].toLowerCase()}, DSN on at ${DEFAULT_PARAMS.dsnMinElDeg}°.`}
      </p>
    </div>
  )
}

export interface CopyLinkProps { explainAll: boolean }

// Copies the page address (which always holds the current view, see useUrlSync).
export function CopyLink({ explainAll }: CopyLinkProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const copy = () => {
    const href = location.href
    const done = () => { setState('copied'); setTimeout(() => setState('idle'), 2500) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(href).then(done, () => setState('manual'))
    else setState('manual')
  }
  return (
    <div className="copy-link">
      <button type="button" className="copy-btn" onClick={copy}>{state === 'copied' ? 'Link copied' : 'Copy link'}</button>
      <Explain term="Copy link" all={explainAll}>{CONTROL_EXPLAIN.share}</Explain>
      {state === 'manual' && (
        <label className="field copy-manual">
          <span>Copying was blocked by the browser. Select this link and copy it:</span>
          <input readOnly value={location.href} onFocus={e => e.currentTarget.select()} />
        </label>
      )}
    </div>
  )
}
