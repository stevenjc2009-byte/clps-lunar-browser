import { useId } from 'react'
import Explain from './Explain'
import { HEAT_EXPLAIN } from './heatmapText'
import type { Params } from './lib/params'
import { PRESETS, presetFor } from './presets'
import './heatmap.css'

export interface PresetPickerProps {
  value: Params
  onChange: (p: Params) => void
  explainAll?: boolean
}

// Drop-down of named, illustrative settings. Shows "Custom settings" when the current
// params match no preset (e.g. after someone moves a single control).
export default function PresetPicker({ value, onChange, explainAll = false }: PresetPickerProps) {
  const id = useId()
  const match = presetFor(value)
  return (
    <div className="preset">
      <label htmlFor={id}>Scenario (illustrative) <Explain term="Scenarios" all={explainAll}>{HEAT_EXPLAIN.presets}</Explain></label>
      <select id={id} value={match?.id ?? 'custom'} aria-describedby={`${id}-why`}
        onChange={e => { const pr = PRESETS.find(x => x.id === e.target.value); if (pr) onChange({ ...pr.params }) }}>
        {!match && <option value="custom" disabled>Custom settings</option>}
        {PRESETS.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
      </select>
      <p id={`${id}-why`} className="preset-why">{match ? match.why : 'Your own mix of settings; pick a scenario to reset them.'}</p>
    </div>
  )
}
