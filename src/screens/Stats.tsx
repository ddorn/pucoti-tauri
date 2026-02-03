import { useState, useEffect } from 'react';
import { exportSessionsCSV, getCSVPath } from '../lib/storage';
import { formatDuration } from '../lib/format';
import { useSessions } from '../hooks/useSessions';
import { useStats } from '../hooks/useStats';
import { Button } from '../components/catalyst/button'
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';
import { StatCard } from '../components/StatCard';
import { AdjustmentPlot } from '../components/AdjustmentPlot';
import { AdjustmentRecommendation } from '../components/AdjustmentRecommendation';
import { CalibrationPlot } from '../components/CalibrationPlot';
import { MedianRangeCard } from '../components/MedianRangeCard';
import { SessionTable } from '../components/SessionTable'

export function Stats() {
  const { sessions, loading, error } = useSessions();
  const { predictionSessions, regression, stats, adjustmentCurve } = useStats(sessions)
  const [csvPath, setCsvPath] = useState<string>('')

  useEffect(() => {
    getCSVPath().then(setCsvPath).catch(console.error)
  }, [])

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
        <Text>{error}</Text>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-8 mb-12 max-w-9xl lg:mx-auto">
      <Heading level={1} className="font-bold">Session Stats</Heading>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <Text className="text-lg">No sessions yet</Text>
          <Text className="mt-1">Complete your first focus session to see your calibration data here.</Text>
        </div>
      ) : (
          <>
            {/* Planning adjustment recommendation */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AdjustmentRecommendation
                adjustmentCurve={adjustmentCurve}
                sessionCount={stats?.predictionCount ?? 0}
              />
              <AdjustmentPlot
                adjustmentCurve={adjustmentCurve}
              />
            </section>

            {/* Calibration analysis */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CalibrationPlot
                sessions={predictionSessions}
                regression={regression}
                stats={stats}
              />
              <MedianRangeCard stats={stats} />
            </section>

            {/* Stats cards */}
            {stats && (
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  value={`${Math.round(Math.abs(stats.meanBias))}%`}
                  label={stats.meanBias > 0 ? 'Average underestimation' : stats.meanBias < 0 ? 'Average overestimation' : 'Estimation bias'}
                  sublabel={stats.biasMargin !== null
                    ? `95% CI: ±${Math.round(stats.biasMargin)} points`
                    : undefined}
                  color={Math.abs(stats.meanBias) < 10 ? 'emerald' : 'amber'}
                />
                <StatCard
                  value={formatDuration(stats.totalSecondsTracked)}
                  label="Total time tracked"
                  sublabel={`across ${stats.completedCount} sessions`}
                  color="zinc"
                />
                <StatCard
                  value={`${Math.round(stats.longerPercent)}%`}
                  label="Tasks taking longer than estimate"
                  color={stats.longerPercent > 60 || stats.longerPercent < 40 ? 'amber' : 'emerald'}
                />
                <StatCard
                  value={`${Math.round(stats.withinTenPercent)}%`}
                  label="Accurate estimates"
                  sublabel="Within ±10% of actual"
                  color={stats.withinTenPercent >= 50 ? 'emerald' : 'amber'}
                />
              </section>
            )}

            <SessionTable sessions={sessions} />

            {/* Export section */}
            <section className="text-center">
              <Text>
                Download all your predictions for further analysis
              </Text>
              {csvPath && (
                <Text>
                  You can also find this CSV at <span className="select-all">{csvPath}</span>
                </Text>
              )}
              <Button outline onClick={handleExport} disabled={sessions.length === 0}>
                Export CSV
              </Button>
            </section>
        </>
      )}
    </div>
  )
}
