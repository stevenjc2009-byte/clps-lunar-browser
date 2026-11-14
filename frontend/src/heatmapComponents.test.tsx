// Server-side render smoke tests (no DOM library needed): every new component renders
// with horizons.json absent (null) and shows the right plain-language text.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CompareDates from './CompareDates'
import Heatmap from './Heatmap'
import MissionFraming from './MissionFraming'
import PresetPicker from './PresetPicker'
import { engineData } from './lib/engine'
import { DEFAULT_PARAMS } from './lib/params'
import { FLAT_WARNING } from './lib/verdict'
import { makeSite, makeSky, squareWave } from './lib/testFixtures'

const N = 120 * 24 + 1
const meta = { landing_min_utc: '2026-11-25T00:00:00Z', landing_max_utc: '2027-02-03T00:00:00Z' }
const a = makeSite('a', squareWave(N, 200, 150), squareWave(N, 100, 60))
const b = makeSite('b', squareWave(N, 300, 50, 1, 77), squareWave(N, 50, 30, 1, 5))
const ed = engineData(makeSky([a, b], {}, meta), null)
const noop = () => {}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('Heatmap (horizons null)', () => {
  const html = renderToStaticMarkup(
    <Heatmap ed={ed} sites={[a, b]} params={DEFAULT_PARAMS} landingDay="2026-12-01" onPickDate={noop} siteId="b" />)
  it('renders the controls, a focusable heatmap and a canvas', () => {
    expect(html).toContain('<canvas')
    expect(html).toMatch(/tabindex="0"[^>]*role="application"|role="application"[^>]*tabindex="0"/)
    expect(text(html)).toContain('Sun visible')
    expect(text(html)).toContain('Longest darkness')
    expect(text(html)).toContain('Landing days 25 Nov 2026 to')
  })
  it('flags flat-horizon rows as provisional and names the recommended site', () => {
    expect(text(html)).toContain(FLAT_WARNING)
    expect(text(html)).toMatch(/(Best landing dates for B|At B, every landing date)/)
  })
  it('shows the empty message when no day fits', () => {
    const tiny = engineData(makeSky([makeSite('t', squareWave(48, 10, 10))], {}, meta), null)
    const h = renderToStaticMarkup(<Heatmap ed={tiny} sites={tiny.sky.sites} params={DEFAULT_PARAMS} landingDay="" onPickDate={noop} />)
    expect(text(h)).toContain('No landing days fit')
  })
})

describe('CompareDates (horizons null)', () => {
  it('shows both dates, the four measures and B minus A', () => {
    const html = renderToStaticMarkup(
      <CompareDates ed={ed} site={a} params={DEFAULT_PARAMS} days={30} dateA="2026-11-25" dateB="2026-12-10" onChange={noop} />)
    const t = text(html)
    expect(t).toContain('A: 25 Nov 2026')
    expect(t).toContain('B: 10 Dec 2026')
    for (const m of ['Sun visible', 'Earth visible', 'Longest darkness', 'Dark at landing?', 'B minus A']) expect(t).toContain(m)
    expect(t).toContain(FLAT_WARNING)
  })
  it('says when a date had to be moved into the landing range', () => {
    const html = renderToStaticMarkup(
      <CompareDates ed={ed} site={a} params={DEFAULT_PARAMS} days={30} dateA="2026-09-02" dateB="2026-12-10" onChange={noop} />)
    expect(text(html)).toContain('Date A is before the landing range, so 25 Nov 2026 is used')
  })
})

describe('PresetPicker', () => {
  it('selects the matching preset and explains it; custom when none match', () => {
    const def = renderToStaticMarkup(<PresetPicker value={DEFAULT_PARAMS} onChange={noop} />)
    expect(def).toMatch(/<option value="default" selected="">/)
    expect(text(def)).toContain('Antenna and panels 2 m up')
    const custom = renderToStaticMarkup(<PresetPicker value={{ ...DEFAULT_PARAMS, maskOffsetDeg: 10 }} onChange={noop} />)
    expect(custom).toMatch(/<option value="custom" disabled="" selected="">Custom settings/)
  })
})

describe('MissionFraming', () => {
  it('says what the tool is not', () => {
    const t = text(renderToStaticMarkup(<MissionFraming />))
    expect(t).toContain('Not a mission-planning tool')
    expect(t).toContain('not an official NASA product')
  })
})
