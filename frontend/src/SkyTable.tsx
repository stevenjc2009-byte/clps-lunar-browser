import { evenIndices, fmtDateTime } from './skyModel'

interface Props {
  siteName: string
  sunAz: number[]; sunAlt: number[]; earthAz: number[]; earthAlt: number[]
  t0Ms?: number; stepHours: number
}

const range = (a: number[]) => (a.length ? `${Math.min(...a).toFixed(1)}° to ${Math.max(...a).toFixed(1)}°` : 'none')

// Text alternative to the sky graph: height ranges and a few evenly spaced samples, in a table.
export default function SkyTable({ siteName, sunAz, sunAlt, earthAz, earthAlt, t0Ms, stepHours }: Props) {
  const rows = evenIndices(sunAlt.length, 8)
  return (
    <details className="sky-table">
      <summary>Show the numbers behind the sky graph</summary>
      <p>Sun height {range(sunAlt)}. Earth height {range(earthAlt)}. {sunAlt.length} hourly samples; {rows.length} evenly spaced ones are listed.</p>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`Sky graph samples for ${siteName}`}>
        <table>
          <caption className="sr-only">Sun and Earth direction and height at evenly spaced hours for {siteName}</caption>
          <thead>
            <tr><th scope="col">Time</th><th scope="col">Sun direction</th><th scope="col">Sun height</th>
              <th scope="col">Earth direction</th><th scope="col">Earth height</th></tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i}>
                <th scope="row">{t0Ms === undefined ? `Sample ${i + 1}` : fmtDateTime(t0Ms + i * stepHours * 3_600_000)}</th>
                <td>{sunAz[i].toFixed(1)}°</td><td>{sunAlt[i].toFixed(2)}°</td>
                <td>{earthAz[i].toFixed(1)}°</td><td>{earthAlt[i].toFixed(2)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
