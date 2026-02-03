import { useEffect, useRef } from 'react'
import Plotly from '../lib/plotly-custom'
import type { Session } from '../lib/storage'
import type { AccentColor } from '../lib/colors'
import { COLOR_PALETTES } from '../lib/colors'
import { createPlotLayout, createPlotConfig } from '../lib/plot-config'

export function EstimationHistogram({
  sessions,
  currentError,
  accentColor,
}: {
  sessions: Session[]
  currentError: number
  accentColor: AccentColor
}) {
  const plotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = plotRef.current
    if (!container) return

    // Filter to predict mode sessions only
    const predictSessions = sessions.filter(
      s => s.status === 'completed' && s.tags.includes('mode:predict')
    )

    // Calculate error percentages for all sessions
    const errors = predictSessions.map(s =>
      ((s.actualSeconds - s.predictedSeconds) / s.predictedSeconds) * 100
    )

    // Determine range for the plot
    // Min: min(-100%, pred%-20%)
    // Max: at least 100%, at least current% + 20, but hide top 3% outliers
    const sortedErrors = [...errors].sort((a, b) => a - b)
    const p97Index = Math.floor(sortedErrors.length * 0.97)
    const p97Value = sortedErrors[p97Index] || 100

    const minError = Math.min(-100, currentError - 30)
    const maxError = Math.max(100, currentError + 20, p97Value)
    const range: [number, number] = [minError, maxError]

    const traces: Plotly.Data[] = []
    // Based on Silverman's rule of thumb for kernel density estimation
    // but tweaked by Diego to look better for this use case
    // We know that most things are within ±100%. Also it's just a magic guess for the 15.
    const diegoSilvermanBandwidth = 15 * Math.pow(errors.length, -1/5)

    // Horizontal half-violin plot showing distribution of errors
    traces.push({
      x: errors,
      type: 'violin',
      orientation: 'h',
      side: 'positive',
      width: 0.8,
      fillcolor: 'rgba(161, 161, 170, 0.15)', // Subtle zinc color
      line: {
        color: '#71717a',
        width: 1,
      },
      meanline: { visible: false },
      box: { visible: false },
      points: false,
      hoverinfo: 'skip',
      showlegend: false,
      y0: 0,
      bandwidth: diegoSilvermanBandwidth, // Lower value = less smooth, more detail
    })


    const accentPalette = COLOR_PALETTES[accentColor]

    // Add color zone shapes (background)
    const shapes: Partial<Plotly.Shape>[] = [
      // Green zone (-10% to +10%)
      {
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: -10,
        x1: 10,
        y0: 0,
        y1: 1,
        fillcolor: accentPalette.muted + "50",
        line: { width: 0 },
        layer: 'below',
      },
    ]

    // Annotations
    const annotations: Partial<Plotly.Annotations>[] = [
      // "perfect" label at 0%
      {
        x: 0,
        y: 0.9,
        xref: 'x',
        yref: 'paper',
        text: 'perfect',
        showarrow: false,
        font: {
          color: accentPalette.base,
          size: 11,
          family: 'system-ui',
        },
      },
    ]

    // Add stem for "this prediction" marker
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: currentError,
      x1: currentError,
      y0: 0,
      y1: 0.6,
      line: {
        color: accentPalette.base,
        width: 2,
      },
      layer: 'above',
    })

    // Add "this prediction" marker for current session
    traces.push({
      x: [currentError],
      y: [0.5],
      mode: 'markers+text',
      type: 'scatter',
      marker: {
        color: accentPalette.base,
        size: 12,
        symbol: 'diamond',
        line: {
          color: '#fff',
          width: 2,
        },
      },
      text: ['this prediction'],
      textposition: 'top center',
      textfont: {
        color: accentPalette.base,
        size: 11,
        family: 'system-ui',
      },
      name: 'This session',
      hovertemplate: `Your error: ${currentError.toFixed(1)}%<extra></extra>`,
    })

    const layout = createPlotLayout({
      xaxis: {
        title: {
          text: 'Estimation Error',
          font: { color: '#a1a1aa', size: 13 },
        },
        gridcolor: '#27272a',
        zerolinecolor: '#52525b',
        zerolinewidth: 2,
        range,
        ticksuffix: '%',
        tickfont: { size: 12 },
      },
      yaxis: {
        visible: false,
        range: [-0.3, 1.0],
      },
      shapes,
      annotations,
      showlegend: false,
      margin: { l: 20, r: 20, t: 0, b: 45 },
      height: 180,
    })

    Plotly.newPlot(container, traces, layout, createPlotConfig())

    return () => {
      Plotly.purge(container)
    }
  }, [sessions, currentError, accentColor])

  return <div ref={plotRef} className="w-full" />
}
