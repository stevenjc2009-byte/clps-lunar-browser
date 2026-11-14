import type Plotly from 'plotly.js-dist-min'

// Plotly is ~1.5 MB of the download; fetching it separately lets the comparison
// cards show first while the chart library is still loading. Shared by both charts.
let plotlyPromise: Promise<typeof Plotly> | null = null
export const loadPlotly = () => (plotlyPromise ??= import('plotly.js-dist-min').then(m => m.default))
export const plotlyLoaded = () => plotlyPromise
