import { useEffect, useRef } from 'react'
import Plotly from '../lib/plotly-custom'
import { Text } from './catalyst/text'
import { Subheading } from './catalyst/heading'
import { createPlotLayout, createPlotConfig } from '../lib/plot-config'
import type { BucketData } from '../hooks/useStats'

export function DurationBucketChart({ data, barColor }: { data: BucketData[]; barColor: string }) {
  const plotRef = useRef<HTMLDivElement | null>(null)
  const hasData = data.some(d => d.onTime !== null)

  useEffect(() => {
    if (!hasData) return
    const container = plotRef.current
    if (!container) return

    const traces: Plotly.Data[] = [
      {
        x: data.map(d => d.bucket),
        y: data.map(d => d.onTime?.rate ?? 0),
        type: 'bar',
        name: 'On-time rate',
        marker: {
          color: data.map(d => d.sessionCount > 0 ? barColor : 'transparent'),
        },
        error_y: {
          type: 'data',
          symmetric: false,
          array: data.map(d => d.onTime ? d.onTime.ci95High - d.onTime.rate : 0),
          arrayminus: data.map(d => d.onTime ? d.onTime.rate - d.onTime.ci95Low : 0),
          color: '#a1a1aa',
          thickness: 1.5,
          width: 4,
        },
        hovertemplate: data.map(d =>
          d.sessionCount > 0
            ? `${d.bucket}<br>On-time: ${Math.round(d.onTime!.rate)}%<br>${d.sessionCount} session${d.sessionCount !== 1 ? 's' : ''}<extra></extra>`
            : `${d.bucket}<br>No predictions<extra></extra>`
        ),
      },
    ]

    // Session count annotations above error bars
    const annotations = data
      .filter(d => d.sessionCount > 0)
      .map(d => ({
        x: d.bucket,
        y: d.onTime ? Math.min(d.onTime.ci95High + 8, 108) : 8,
        text: `${d.sessionCount} session${d.sessionCount !== 1 ? 's' : ''}`,
        showarrow: false,
        font: { color: '#a1a1aa', size: 11 },
      }))

    const layout = createPlotLayout({
      xaxis: {
        title: { text: 'Predicted duration', font: { color: '#a1a1aa' } },
        gridcolor: '#27272a',
        type: 'category',
        range: [-0.7, data.length - 0.3],
      },
      yaxis: {
        title: { text: 'Predictions correct (%)', font: { color: '#a1a1aa' } },
        gridcolor: '#27272a',
        range: [0, 115],
      },
      showlegend: false,
      bargap: 0.3,
      annotations,
      shapes: [{
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: 80,
        y1: 80,
        line: { color: '#22c55e', width: 2, dash: 'dash' },
      }],
    })

    Plotly.newPlot(container, traces, layout, createPlotConfig())

    return () => { Plotly.purge(container) }
  }, [data, hasData, barColor])

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <div className="mb-4">
        <Subheading level={2}>Which task lengths trip you up?</Subheading>
        <Text className="text-zinc-400 mt-1">How accurate your predictions are, broken down by how long you thought a task would take.</Text>
      </div>
      {hasData ? (
        <div ref={plotRef} className="w-full h-72" />
      ) : (
        <div className="flex items-center justify-center h-72">
          <Text>Complete prediction sessions to see duration analysis</Text>
        </div>
      )}
    </div>
  )
}
