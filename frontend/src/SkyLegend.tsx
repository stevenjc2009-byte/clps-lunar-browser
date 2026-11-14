import Explain from './Explain'
import { EXPLAIN } from './explanations'
import { EARTH_MEAN_RADIUS_DEG, EARTH_RAMP, fmtDate, meanRadius, rampCss, SUN_MEAN_RADIUS_DEG, SUN_RAMP } from './skyModel'

const PX_PER_DEG = 30   // the size legend: 1 degree of sky is drawn 30 px long, the same in both directions

interface Props {
  startMs?: number; endMs?: number
  flat: boolean; widened: boolean; range: [number, number]
  sunRadius?: number[]; earthRadius?: number[]; start: number; end: number
  explainAll?: boolean
}

// Legend under the sky graph: time colour, skyline note, and Sun / Earth disc sizes to scale.
export default function SkyLegend({ startMs, endMs, flat, widened, range, sunRadius, earthRadius, start, end, explainAll = false }: Props) {
  const rs = meanRadius(sunRadius, start, end, SUN_MEAN_RADIUS_DEG)
  const re = meanRadius(earthRadius, start, end, EARTH_MEAN_RADIUS_DEG)
  const known = sunRadius && earthRadius
  const w = Math.ceil(re * PX_PER_DEG * 2) + 4
  return (
    <div className="sky-legend">
      <div className="sky-key" aria-hidden="true">
        <span className="sky-key-label">Early</span>
        <span className="ramp" style={{ background: rampCss(SUN_RAMP) }} />
        <span className="ramp" style={{ background: rampCss(EARTH_RAMP) }} />
        <span className="sky-key-label">Late</span>
      </div>
      <p className="sky-note">
        Dot colour shows time: darker is early, paler is late
        {startMs !== undefined && endMs !== undefined ? ` (${fmtDate(startMs)} to ${fmtDate(endMs)}, UTC)` : ''}.
        Sun dots are circles; Earth dots are diamonds.
      </p>
      <p className="sky-note">
        {flat
          ? <><b>Flat horizon:</b> no terrain data for this site, so hills and crater walls are not drawn and hidden or visible is approximate.</>
          : <><b>Terrain skyline:</b> the grey shape is the real horizon from NASA LOLA elevation data. Dots inside it are hidden.</>}
        {widened && <> The height axis was widened to {range[0]}° to {range[1]}° to fit the data.</>}
      </p>
      <div className="sky-scale">
        <svg width={w} height={w} viewBox={`${-w / 2} ${-w / 2} ${w} ${w}`} role="img"
          aria-label={`Size to scale: Sun radius ${rs.toFixed(2)} degrees, Earth radius ${re.toFixed(2)} degrees`}>
          <circle r={re * PX_PER_DEG} fill="none" stroke="#4da3ff" strokeWidth="2" />
          <circle r={rs * PX_PER_DEG} fill="#ffb627" />
        </svg>
        <p className="sky-note">
          Size to scale: Sun radius about {rs.toFixed(2)}°, Earth radius about {re.toFixed(2)}°
          {known ? ' (average over your dates)' : ' (typical values)'}. 1° is drawn {PX_PER_DEG} px long here.
          <Explain term="Sun and Earth size" all={explainAll}>{EXPLAIN.graphScale}</Explain>
        </p>
      </div>
    </div>
  )
}
