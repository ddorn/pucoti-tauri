import { exportSessionsCSV } from '../lib/storage';
import { formatDuration } from '../lib/format';
import { useSessions } from '../hooks/useSessions';
import { useStats } from '../hooks/useStats';
import { Button } from '../components/catalyst/button'
import { Text } from '../components/catalyst/text';
import { Heading } from '../components/catalyst/heading';
import { StatCard } from '../components/StatCard';
import { AdjustmentHeadline } from '../components/AdjustmentHeadline';
import { AdjustmentPlot } from '../components/AdjustmentPlot';
import { CalibrationPlot } from '../components/CalibrationPlot';
import { SessionTable } from '../components/SessionTable'

export function Stats() {
  const { sessions, loading, error } = useSessions();
  const { completedSessions, regression, stats, adjustmentCurve } = useStats(sessions)

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
            {adjustmentCurve && adjustmentCurve.adjustment80 !== null && (
              <AdjustmentHeadline
                adjustmentCurve={adjustmentCurve}
                sessionCount={completedSessions.length}
              />
            )}

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AdjustmentPlot adjustmentCurve={adjustmentCurve} />
              <CalibrationPlot
                completedSessions={completedSessions}
                regression={regression}
              />
            </section>

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

            <SessionTable sessions={sessions} />
        </>
      )}
    </div>
  )
}
