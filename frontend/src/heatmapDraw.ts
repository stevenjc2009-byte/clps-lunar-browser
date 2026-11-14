// Canvas drawing for the landing heatmap. One canvas for ~2,700 cells is far lighter than
// the same number of SVG or DOM elements; keyboard and screen-reader access come from the
// focusable wrapper and live readout in Heatmap.tsx, not from the pixels.

import { cellColor } from './lib/heatmapColor'
import type { HeatGrid } from './lib/heatmapData'

export const ROW_H = 26        // one site row
export const CELL_H = 19       // coloured part of the row
export const MARK_H = 3        // "best 10%" strip under the cells
export const AXIS_H = 22       // month ticks below the rows
export const MIN_CELL_W = 2    // below this the canvas scrolls sideways instead of shrinking

export interface Layout { cellW: number; width: number; height: number; rows: number; days: number }
export interface CellRef { r: number; i: number }

export function makeLayout(days: number, rows: number, availableW: number): Layout {
  const width = Math.max(Math.floor(availableW), days * MIN_CELL_W, 1)
  return { cellW: days ? width / days : 1, width, height: rows * ROW_H + AXIS_H, rows, days }
}

export function hitTest(l: Layout, x: number, y: number): CellRef | null {
  const i = Math.floor(x / l.cellW), r = Math.floor(y / ROW_H)
  return i >= 0 && i < l.days && r >= 0 && r < l.rows ? { r, i } : null
}

export const cellX = (l: Layout, i: number) => i * l.cellW

let hatch: CanvasPattern | null | undefined
function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (hatch !== undefined) return hatch
  const c = document.createElement('canvas')
  c.width = c.height = 6
  const g = c.getContext('2d')
  if (!g) return (hatch = null)
  g.strokeStyle = 'rgba(4,6,13,0.85)'
  g.lineWidth = 1.5
  g.beginPath(); g.moveTo(0, 6); g.lineTo(6, 0); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(5, 7); g.lineTo(7, 5); g.stroke()
  return (hatch = ctx.createPattern(c, 'repeat'))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A white line with a dark edge stays visible over both ends of the colour scale.
function outlined(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.strokeStyle = '#04060d'; ctx.lineWidth = 3.5; draw()
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; draw()
}

export interface DrawOpts { landingIdx: number; active: CellRef | null; focused: boolean; dpr: number }

export function drawHeatmap(canvas: HTMLCanvasElement, g: HeatGrid, l: Layout, o: DrawOpts) {
  canvas.width = Math.round(l.width * o.dpr)
  canvas.height = Math.round(l.height * o.dpr)
  canvas.style.width = `${l.width}px`
  canvas.style.height = `${l.height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0)
  ctx.clearRect(0, 0, l.width, l.height)
  const w = Math.max(1, l.cellW + 0.6) // slight overlap hides seams between fractional cells
  const pat = hatchPattern(ctx)

  g.rows.forEach((row, r) => {
    const y = r * ROW_H
    for (let i = 0; i < l.days; i++) {
      const x = cellX(l, i)
      ctx.fillStyle = cellColor(row.values[i], g.metric, g.domain)
      ctx.fillRect(x, y, w, CELL_H)
      if (row.censored[i] && pat) { ctx.fillStyle = pat; ctx.fillRect(x, y, w, CELL_H) }
      if (row.best[i]) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + CELL_H + 1, w, MARK_H) }
    }
  })

  const rowsH = l.rows * ROW_H
  ctx.font = '11px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'top'
  let labelEnd = -Infinity // right edge of the last label drawn, so labels never overlap
  g.days.isos.forEach((iso, i) => {
    if (!iso.endsWith('-01') && i !== 0) return
    const x = Math.round(cellX(l, i)) + 0.5
    ctx.strokeStyle = '#3a4b72'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x, rowsH); ctx.lineTo(x, rowsH + 5); ctx.stroke()
    const m = Number(iso.slice(5, 7)) - 1
    const label = m === 0 || i === 0 ? `${MONTHS[m]} ${iso.slice(0, 4)}` : MONTHS[m]
    const w = ctx.measureText(label).width
    if (x + w + 2 > l.width || x + 2 < labelEnd + 6) return
    ctx.fillStyle = '#8d9ab3'
    ctx.fillText(label, x + 2, rowsH + 6)
    labelEnd = x + 2 + w
  })

  if (o.landingIdx >= 0) {
    const x = cellX(l, o.landingIdx) + l.cellW / 2
    outlined(ctx, () => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, rowsH); ctx.stroke() })
  }
  if (o.active) {
    const x = cellX(l, o.active.i), y = o.active.r * ROW_H
    const bw = Math.max(l.cellW, 6)
    const bx = x + l.cellW / 2 - bw / 2
    // Thicker box while the heatmap has keyboard focus, so the focus is easy to see.
    if (o.focused) { ctx.strokeStyle = '#04060d'; ctx.lineWidth = 6; ctx.strokeRect(bx - 1, y - 1, bw + 2, CELL_H + 2) }
    outlined(ctx, () => ctx.strokeRect(bx - 1, y - 1, bw + 2, CELL_H + 2))
  }
}
