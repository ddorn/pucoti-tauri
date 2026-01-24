import type { Layout, Config } from 'plotly.js-dist-min'

export function createPlotLayout(overrides?: Partial<Layout>): Partial<Layout> {
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#a1a1aa', family: 'system-ui' },
    margin: { l: 60, r: 20, t: 40, b: 60 },
    legend: {
      x: 0.98,
      y: 0.02,
      xanchor: 'right',
      yanchor: 'bottom',
      bgcolor: 'rgba(255, 255, 255, 0.05)',
    },
    showlegend: true,
    ...overrides,
  }
}

export function createPlotConfig(): Partial<Config> {
  return {
    displayModeBar: false,
    responsive: true,
  }
}
