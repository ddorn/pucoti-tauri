import { useState, useEffect, useMemo, useRef } from 'react';
import { loadSessions, exportSessionsCSV, type Session } from '../lib/storage'
import { formatDuration, formatTimestamp } from '../lib/format'
import { linearRegression } from '../lib/regression'
import { Button } from '../components/catalyst/button'
import { Badge } from '../components/catalyst/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table'
import Plotly from 'plotly.js-dist-min'

export function History() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const plotContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    loadSessions()
      .then(setSessions)
      .catch(err => {
        console.error('Failed to load sessions:', err)
        setError(err?.message || 'Failed to load sessions')
      })
      .finally(() => setLoading(false))
  }, [])

  // Only completed sessions for the calibration plot
  const completedSessions = useMemo(
    () => sessions.filter(s => s.status === 'completed'),
    [sessions]
  )

  // Regression for completed sessions
  const regression = useMemo(() => {
    const points = completedSessions.map(s => ({
      x: s.predictedSeconds / 60, // Convert to minutes for plot
      y: s.actualSeconds / 60,
    }))
    return linearRegression(points)
  }, [completedSessions])

  // Draw calibration plot
  useEffect(() => {
    if (completedSessions.length < 2) return;
    if (!plotContainerRef.current) {
      throw new Error('Calibration plot container missing');
    }

    const predicted = completedSessions.map(s => s.predictedSeconds / 60)
    const actual = completedSessions.map(s => s.actualSeconds / 60)

    const maxVal = Math.max(...predicted, ...actual, 30) * 1.1

    const traces: Plotly.Data[] = [
      // Scatter points
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
      // y = x reference line (perfect calibration)
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

    // Add regression line if we have enough data
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

    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#a1a1aa', family: 'system-ui' },
      margin: { l: 60, r: 20, t: 40, b: 60 },
      xaxis: {
        title: 'Predicted (min)',
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
        range: [0, maxVal],
      },
      yaxis: {
        title: 'Actual (min)',
        gridcolor: '#27272a',
        zerolinecolor: '#3f3f46',
        range: [0, maxVal],
      },
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: 'transparent',
      },
      showlegend: true,
    }

    const config: Partial<Plotly.Config> = {
      displayModeBar: false,
      responsive: true,
    }

    Plotly.newPlot(plotContainerRef.current, traces, layout, config)

    return () => {
      Plotly.purge(plotContainerRef.current)
    }
  }, [completedSessions, regression])

  const handleExport = async () => {
    try {
      const csv = await exportSessionsCSV()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `predicoti-sessions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-zinc-500">Loading history...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <p className="text-red-400 text-lg mb-2">Error loading history</p>
        <p className="text-zinc-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">Session History</h1>
        <Button outline onClick={handleExport} disabled={sessions.length === 0}>
          Export CSV
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-500 text-lg">No sessions yet</p>
          <p className="text-zinc-600 mt-1">Complete your first focus session to see your calibration data here.</p>
        </div>
      ) : (
        <>
          {/* Calibration Plot */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">Calibration</h2>
            {completedSessions.length < 2 ? (
              <div className="bg-surface-raised rounded-lg p-8 text-center">
                <p className="text-zinc-500">
                  Complete at least 2 sessions to see your calibration plot.
                </p>
              </div>
            ) : (
              <div className="bg-surface-raised rounded-lg p-4">
                    <div ref={plotContainerRef} className="w-full h-72" />
                {regression && (
                  <p className="text-sm text-zinc-500 mt-2 text-center">
                    {regression.slope > 1.1 ? (
                      <>You tend to <span className="text-amber-400">underestimate</span> time needed</>
                    ) : regression.slope < 0.9 ? (
                      <>You tend to <span className="text-emerald-400">overestimate</span> time needed</>
                    ) : (
                      <>Your estimates are <span className="text-emerald-400">well calibrated</span>!</>
                    )}
                    {' '}(slope: {regression.slope.toFixed(2)})
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Session Table */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">All Sessions</h2>
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>Focus</TableHeader>
                    <TableHeader>Predicted</TableHeader>
                    <TableHeader>Actual</TableHeader>
                    <TableHeader>Status</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.slice().reverse().map((session, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-zinc-400 whitespace-nowrap">
                        {formatTimestamp(session.timestamp).slice(0, 16)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {session.focusText}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {formatDuration(session.predictedSeconds)}
                      </TableCell>
                      <TableCell className="text-zinc-300">
                        {formatDuration(session.actualSeconds)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={session.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: Session['status'] }) {
  switch (status) {
    case 'completed':
      return <Badge color="green">completed</Badge>
    case 'canceled':
      return <Badge color="zinc">canceled</Badge>
    case 'unknown':
      return <Badge color="amber">unknown</Badge>
  }
}
