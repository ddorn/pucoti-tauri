import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import { Text } from './catalyst/text'
import { Subheading } from './catalyst/heading'
import type { AdjustmentCurve } from '../lib/stats'
import { createPlotLayout, createPlotConfig } from '../lib/plot-config'

export function AdjustmentPlot({ adjustmentCurve }: { adjustmentCurve: AdjustmentCurve | null }) {
  const plotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!adjustmentCurve) return
    const container = plotRef.current
    if (!container) return

    const traces: Plotly.Data[] = [
      {
        x: adjustmentCurve.adjustments,
        y: adjustmentCurve.onTimeRates,
        mode: 'lines',
        type: 'scatter',
        name: 'On-time rate',
        line: {
          color: '#f59e0b',
          width: 3,
        },
        hovertemplate: 'Adjustment: %{x:+.0f}%<br>On-time: %{y:.0f}%<extra></extra>',
      },
      {
        x: [adjustmentCurve.adjustments[0], adjustmentCurve.adjustments[adjustmentCurve.adjustments.length - 1]],
        y: [80, 80],
        mode: 'lines',
        type: 'scatter',
        name: '80% target',
        line: {
          color: '#22c55e',
          width: 2,
          dash: 'dash',
        },
        hoverinfo: 'skip',
      },
    ]

    if (adjustmentCurve.adjustment80 !== null) {
      traces.push({
        x: [adjustmentCurve.adjustment80, adjustmentCurve.adjustment80],
        y: [0, 100],
        mode: 'lines',
        type: 'scatter',
        name: 'Target adjustment',
        line: {
          color: '#22c55e',
          width: 2,
          dash: 'dot',
        },
        hoverinfo: 'skip',
      })
    }

    const layout = createPlotLayout({
      xaxis: {
        title: 'Adjustment (%)',
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
      },
      yaxis: {
        title: 'On-time rate (%)',
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
        range: [0, 100],
      },
    })

    Plotly.newPlot(container, traces, layout, createPlotConfig())

    return () => {
      Plotly.purge(container)
    }
  }, [adjustmentCurve])

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <Subheading level={2} className="mb-4">Adjustment Impact</Subheading>
      {adjustmentCurve ? (
        <div ref={plotRef} className="w-full h-72" />
      ) : (
        <div className="flex items-center justify-center h-72">
          <Text>Complete more sessions to see adjustment analysis</Text>
        </div>
      )}
    </div>
  )
}
