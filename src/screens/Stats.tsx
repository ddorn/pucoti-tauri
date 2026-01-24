import { useState, useEffect, useMemo, useRef } from 'react';
import { loadSessions, exportSessionsCSV, type Session } from '../lib/storage'
import { formatDuration, formatTime } from '../lib/format';
import { computeCalibrationStats, computeRegressionWithCI } from '../lib/stats';
import { Button } from '../components/catalyst/button'
import { Badge } from '../components/catalyst/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table'
import { Text } from '../components/catalyst/text';
import { Heading, Subheading } from '../components/catalyst/heading';
import { Switch } from '../components/catalyst/switch';
import Plotly from 'plotly.js-dist-min'

export function Stats() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [relativeTime, setRelativeTime] = useState(true)
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

  // Regression for completed sessions (with confidence interval for slope)
  const regression = useMemo(() => {
    const points = completedSessions.map(s => ({
      x: s.predictedSeconds / 60, // Convert to minutes for plot
      y: s.actualSeconds / 60,
    }))
    return computeRegressionWithCI(points)
  }, [completedSessions])

  // Compute summary statistics for the cards
  const stats = useMemo(
    () => computeCalibrationStats(sessions),
    [sessions]
  )

  // Draw calibration plot
  useEffect(() => {
    if (completedSessions.length < 2) return;
    const container = plotContainerRef.current;
    if (!container) {
      console.warn('Calibration plot container missing');
      return;
    }

    const predicted = completedSessions.map(s => s.predictedSeconds / 60)
    const actual = completedSessions.map(s => s.actualSeconds / 60)

    const maxVal = Math.max(...predicted, ...actual, 5) * 1.1

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

    Plotly.newPlot(container, traces, layout, config)

    return () => {
      Plotly.purge(container)
    }
  }, [completedSessions, regression])

  const handleExport = async () => {
    try {
      const csv = await exportSessionsCSV()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pucoti-sessions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Text>Loading stats...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
        <p className="text-red-400 text-lg mb-2">Error loading stats</p>
        <Text className="text-sm">{error}</Text>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <Heading level={1} className="font-bold">Session Stats</Heading>
        <Button outline onClick={handleExport} disabled={sessions.length === 0}>
          Export CSV
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <Text className="text-lg">No sessions yet</Text>
          <Text className="mt-1">Complete your first focus session to see your calibration data here.</Text>
        </div>
      ) : (
        <>
            {/* Stats Cards */}
            {stats && (
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  value={`${Math.round(Math.abs(stats.meanBias))}%`}
                  label={stats.meanBias > 0 ? 'You underestimate by' : stats.meanBias < 0 ? 'You overestimate by' : 'Estimation bias'}
                  sublabel={stats.biasMargin !== null
                    ? `95% CI: ±${Math.round(stats.biasMargin)} points`
                    : undefined}
                  color={Math.abs(stats.meanBias) < 10 ? 'emerald' : 'amber'}
                />
                <StatCard
                  value={formatDuration(stats.totalSeconds)}
                  label="You tracked"
                  sublabel={`across ${stats.sessionCount} sessions`}
                  color="zinc"
                />
                <StatCard
                  value={`${Math.round(stats.longerPercent)}%`}
                  label="Sessions taking longer than expected"
                  color={stats.longerPercent > 60 || stats.longerPercent < 40 ? 'amber' : 'emerald'}
                />
                <StatCard
                  value={`${Math.round(stats.withinTenPercent)}%`}
                  label="Estimates within ±10%"
                  sublabel={stats.withinTenPercent >= 50 ? 'Good accuracy!' : 'Room for improvement'}
                  color={stats.withinTenPercent >= 50 ? 'emerald' : 'amber'}
                />
              </section>
            )}

          {/* Calibration Plot */}
          <section>
              <Subheading level={2} className="mb-4">Calibration</Subheading>
            {completedSessions.length < 2 ? (
              <div className="bg-surface-raised rounded-lg p-8 text-center">
                  <Text>
                  Complete at least 2 sessions to see your calibration plot.
                  </Text>
              </div>
            ) : (
              <div className="bg-surface-raised rounded-lg p-4">
                    <div ref={plotContainerRef} className="w-full h-72" />
                {regression && (
                      <Text className="text-sm mt-2 text-center">
                    {regression.slope > 1.1 ? (
                      <>You tend to <span className="text-amber-400">underestimate</span> time needed</>
                    ) : regression.slope < 0.9 ? (
                      <>You tend to <span className="text-emerald-400">overestimate</span> time needed</>
                    ) : (
                      <>Your estimates are <span className="text-emerald-400">well calibrated</span>!</>
                    )}
                        {' '}— slope: {regression.slope.toFixed(2)}
                        {regression.slopeCI && (
                          <span className="text-zinc-500">
                            {' '}(±{((regression.slopeCI.high - regression.slopeCI.low) / 2).toFixed(2)})
                          </span>
                        )}
                      </Text>
                )}
              </div>
            )}
          </section>

          {/* Session Table */}
          <section>
              <div className="flex items-center justify-between mb-4">
                <Subheading level={2}>All Sessions</Subheading>
                <div className="flex items-center gap-2">
                  <Text className="text-sm">{relativeTime ? 'Relative time' : 'Absolute time'}</Text>
                  <Switch checked={relativeTime} onChange={setRelativeTime} />
                </div>
              </div>
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
                      <TableCell className="whitespace-nowrap">
                        {formatTime(session.timestamp, relativeTime)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {session.focusText}
                      </TableCell>
                      <TableCell>
                        {formatDuration(session.predictedSeconds)}
                      </TableCell>
                      <TableCell>
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

function StatCard({
  value,
  label,
  sublabel,
  color,
}: {
  value: string;
  label: string;
  sublabel?: string;
  color: 'emerald' | 'amber' | 'zinc';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    zinc: 'text-zinc-100',
  };

  return (
    <div className="bg-surface-raised rounded-lg p-5">
      <div className="text-sm text-zinc-100 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      {sublabel && (
        <Text className="text-xs text-zinc-500 mt-2">{sublabel}</Text>
      )}
    </div>
  );
}
