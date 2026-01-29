import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import { Text } from './catalyst/text'
import { Subheading } from './catalyst/heading'
import type { Session } from '../lib/storage'
import type { RegressionWithCI, CalibrationStats } from '../lib/stats'
import { createPlotLayout, createPlotConfig } from '../lib/plot-config'

export function CalibrationPlot({
  sessions,
  regression,
  stats,
}: {
  sessions: Session[]
  regression: RegressionWithCI | null
  stats: CalibrationStats | null
}) {
  const plotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (sessions.length < 2) return
    const container = plotRef.current
    if (!container) {
      console.warn('Calibration plot container missing')
      return
    }

    const predicted = sessions.map(s => s.predictedSeconds / 60)
    const actual = sessions.map(s => s.actualSeconds / 60)
    const maxVal = Math.max(...predicted, ...actual, 5) * 1.1

    const traces: Plotly.Data[] = [
      {
        x: predicted,
        y: actual,
        mode: 'markers',
        type: 'scatter',
        name: 'Sessions',
        marker: {
          color: '#f59e0b',
          size: 10,
          opacity: 0.8,
        },
        hovertemplate: 'Predicted: %{x:.0f}m<br>Actual: %{y:.0f}m<extra></extra>',
      },
      {
        x: [0, maxVal],
        y: [0, maxVal],
        mode: 'lines',
        type: 'scatter',
        name: 'Perfect',
        line: {
          color: '#3f3f46',
          width: 2,
          dash: 'dash',
        },
        hoverinfo: 'skip',
      },
    ]

    if (regression) {
      traces.push({
        x: [0, maxVal],
        y: [regression.intercept, regression.slope * maxVal + regression.intercept],
        mode: 'lines',
        type: 'scatter',
        name: `Trend (R²=${regression.rSquared.toFixed(2)})`,
        line: {
          color: '#22c55e',
          width: 2,
        },
        hoverinfo: 'skip',
      })
    }

    // Add Q1 and Q3 lines if we have the IQR data
    if (stats?.ratioIQR) {
      const { q1, q3 } = stats.ratioIQR

      // Q1 line (lower bound - tasks finish faster)
      traces.push({
        x: [0, maxVal],
        y: [0, maxVal * q1],
        mode: 'lines',
        type: 'scatter',
        name: `25th percentile (${q1.toFixed(2)}×)`,
        line: {
          color: '#3b82f6',
          width: 1.5,
          dash: 'dot',
        },
        hoverinfo: 'skip',
      })

      // Q3 line (upper bound - tasks take longer)
      traces.push({
        x: [0, maxVal],
        y: [0, maxVal * q3],
        mode: 'lines',
        type: 'scatter',
        name: `75th percentile (${q3.toFixed(2)}×)`,
        line: {
          color: '#3b82f6',
          width: 1.5,
          dash: 'dot',
        },
        hoverinfo: 'skip',
      })

      // Shaded area between Q1 and Q3
      traces.push({
        x: [0, maxVal, maxVal, 0],
        y: [0, maxVal * q1, maxVal * q3, 0],
        fill: 'toself',
        type: 'scatter',
        name: 'Middle 50% of sessions',
        fillcolor: 'rgba(59, 130, 246, 0.1)',
        line: { width: 0 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    const layout = createPlotLayout({
      xaxis: {
        title: {
          text: 'Your Estimate (minutes)',
          font: { color: '#a1a1aa' },
        },
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
        range: [0, maxVal],
      },
      yaxis: {
        title: {
          text: 'Actual Time Taken (minutes)',
          font: { color: '#a1a1aa' },
        },
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
        range: [0, maxVal],
      },
    })

    Plotly.newPlot(container, traces, layout, createPlotConfig())

    return () => {
      Plotly.purge(container)
    }
  }, [sessions, regression])

  return (
    <div className="bg-surface-raised rounded-lg p-4">
      <Subheading level={2} className="mb-4">Estimation Accuracy</Subheading>
      {sessions.length < 2 ? (
        <div className="flex items-center justify-center h-72">
          <Text>Complete at least 2 sessions to see your estimation pattern</Text>
        </div>
      ) : (
        <>
          <div ref={plotRef} className="w-full h-72" />
          {/* <div className="text-sm mt-3 text-center space-y-1">
            {regression && (
              <Text>
                {regression.slope > 1.1 ? (
                  <>Trend: You tend to <span className="text-amber-400">underestimate</span> (slope: {regression.slope.toFixed(2)})</>
                ) : regression.slope < 0.9 ? (
                  <>Trend: You tend to <span className="text-emerald-400">overestimate</span> (slope: {regression.slope.toFixed(2)})</>
                ) : (
                  <>Trend: <span className="text-emerald-400">Well calibrated</span> (slope: {regression.slope.toFixed(2)})</>
                )}
              </Text>
            )}
          </div> */}
        </>
      )}
    </div>
  )
}
