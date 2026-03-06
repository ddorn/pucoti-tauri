import { useState, useEffect, useRef, useCallback } from 'react'
import { exportSessionsCSV, getCSVPath } from '../lib/storage'
import { formatDuration } from '../lib/format'
import { useSessions } from '../hooks/useSessions'
import { useSettings } from '../context/SettingsContext'
import { COLOR_PALETTES } from '../lib/colors'
import {
  useFilteredSessions,
  useOverallStats,
  useCalibrationOverTime,
  useByDurationBucket,
  useHeatmapData,
  useAdjustmentCurve,
  usePeriodComparison,
  useNotableSessions,
} from '../hooks/useStats'
import { GRANULARITY_LABELS } from '../lib/stats'
import type { TimeRange, Granularity } from '../lib/stats'
import type { SessionSortMode } from '../components/SessionTable'
import { Button } from '../components/catalyst/button'
import { Text } from '../components/catalyst/text'
import { Heading } from '../components/catalyst/heading'
import { StatCard } from '../components/StatCard'
import { AdjustmentRecommendation } from '../components/AdjustmentRecommendation'
import { TimeRangeFilter } from '../components/TimeRangeFilter'
import { CalibrationHeatmap } from '../components/CalibrationHeatmap'
import { NotableSessions } from '../components/NotableSessions'
import { SessionTable } from '../components/SessionTable'
import { CalibrationOverTimeChart, AdjustmentPlot, DurationBucketChart } from '../components/plots'

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-t border-zinc-800 pt-6 -mt-2">
      <Heading level={2} className="mb-1">{title}</Heading>
      {subtitle && <Text className="text-zinc-500 mt-4">{subtitle}</Text>}
    </div>
  )
}

function HeroCard({ currentRate, change, currentN, granularity }: {
  currentRate: number | null
  change: number | null
  currentN: number
  granularity: Granularity
}) {
  const labels = GRANULARITY_LABELS[granularity]
  const hasData = currentRate !== null

  let changeText = ''
  let changeColor = 'text-zinc-400'
  if (change !== null) {
    const abs = Math.abs(Math.round(change))
    if (Math.round(change) > 0) {
      changeText = `${abs}pp better than ${labels.lastLabel}`
      changeColor = 'text-emerald-400'
    } else if (Math.round(change) < 0) {
      changeText = `${abs}pp worse than ${labels.lastLabel}`
      changeColor = 'text-red-400'
    } else {
      changeText = `Same as ${labels.lastLabel}`
      changeColor = 'text-zinc-400'
    }
  } else if (hasData) {
    changeText = `No data from ${labels.lastLabel} to compare`
  }

  return (
    <div className="bg-surface-raised rounded-lg p-6 flex flex-col justify-center min-h-[140px]">
      <div className="text-center">
        <div className="text-xl mb-3">{labels.thisLabel}, you were on time</div>
        {hasData ? (
          <>
            <div className="text-4xl font-bold mb-2">
              <span className={currentRate! >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                {Math.round(currentRate!)}%
              </span>
              <span> of the time</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-sm">
              {changeText && <span className={changeColor}>{changeText}</span>}
              {changeText && <span className="text-zinc-600">·</span>}
              <span className="text-zinc-500">Goal: 80%</span>
            </div>
          </>
        ) : (
          <div className="text-4xl font-bold mb-2 text-zinc-500">no predictions yet</div>
        )}
      </div>
    </div>
  )
}

export function Stats() {
  const { sessions, loading, error } = useSessions()
  const { settings } = useSettings()
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [granularity, setGranularity] = useState<Granularity>('week')
  const [csvPath, setCsvPath] = useState<string>('')
  const [sessionSort, setSessionSort] = useState<SessionSortMode>('predictions')
  const sessionTableRef = useRef<HTMLDivElement>(null)

  const barColor = COLOR_PALETTES[settings.accentColor].base

  const filteredSessions = useFilteredSessions(sessions, timeRange)
  const stats = useOverallStats(filteredSessions)
  const periodComparison = usePeriodComparison(sessions, granularity)
  const calibrationOverTime = useCalibrationOverTime(filteredSessions, granularity)
  const bucketData = useByDurationBucket(filteredSessions)
  const heatmapData = useHeatmapData(sessions)
  const adjustmentCurve = useAdjustmentCurve(filteredSessions)
  const notable = useNotableSessions(filteredSessions, 3)

  useEffect(() => {
    getCSVPath().then(setCsvPath).catch(console.error)
  }, [])

  const handleSeeAll = useCallback((sort: SessionSortMode) => {
    setSessionSort(sort)
    // Scroll to table after state update
    setTimeout(() => {
      sessionTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
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
      {/* Header with global controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Heading level={1} className="font-bold">Session Stats</Heading>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Text className="text-zinc-400">Group by</Text>
            <div className="flex gap-1">
              {GRANULARITY_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  outline={opt.value !== granularity}
                  plain={opt.value !== granularity}
                  color={opt.value === granularity ? 'zinc' : undefined}
                  onClick={() => setGranularity(opt.value)}
                  className="text-sm! px-3! py-1!"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-zinc-400">Showing</Text>
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 max-w-md mx-auto">
          <Text className="text-lg text-zinc-200 mb-2">No sessions yet</Text>
          <Text className="text-zinc-400">
            Start a timer and make a prediction — once you complete sessions, you'll see how well your estimates match reality. Over time this page helps you spot patterns and become a more accurate planner.
          </Text>
        </div>
      ) : (
        <>
          {/* Hero card + stat cards: the immediate answer */}
          <HeroCard
            currentRate={periodComparison.currentRate}
            change={periodComparison.change}
            currentN={periodComparison.currentN}
            granularity={granularity}
          />

          <section className="grid grid-cols-3 gap-4">
            <StatCard
              value={stats?.onTimeRate ? `${Math.round(stats.onTimeRate.rate)}%` : '—'}
              label="Overall on-time rate"
              sublabel={stats?.onTimeRate ? `${stats.onTimeRate.n} predictions` : undefined}
              color={stats?.onTimeRate && stats.onTimeRate.rate >= 70 ? 'emerald' : 'amber'}
            />
            <StatCard
              value={stats ? formatDuration(stats.totalSecondsTracked) : '—'}
              label="Total time tracked"
              sublabel={stats ? `across ${stats.completedCount} sessions` : undefined}
              color="zinc"
            />
            <StatCard
              value={stats ? `${stats.predictionCount}` : '0'}
              label="Predictions"
              sublabel={periodComparison.currentN > 0
                ? `${periodComparison.currentN} ${GRANULARITY_LABELS[granularity].thisLabel.toLowerCase()}`
                : undefined}
              color="zinc"
            />
          </section>

          {/* Section: trend over time */}
          <SectionHeader
            title="Are you getting better?"
            subtitle="Each bar shows what share of your predictions came true. The green line marks 80% — look for an upward trend."
          />
          <CalibrationOverTimeChart
            data={calibrationOverTime}
            granularity={granularity}
            barColor={barColor}
          />

          {/* Section: where estimates break down */}
          <SectionHeader
            title="Where do estimates go wrong?"
            subtitle="Look for task types or durations where you consistently miss."
          />
          <DurationBucketChart data={bucketData} barColor={barColor} />
          <CalibrationHeatmap data={heatmapData} />
          <NotableSessions
            mostUnderestimated={notable.mostUnderestimated}
            mostOverestimated={notable.mostOverestimated}
            bestCalibrated={notable.bestCalibrated}
            onSeeAll={handleSeeAll}
          />

          {/* Section: actionable takeaway */}
          <SectionHeader
            title="Your adjustment formula"
            subtitle="If you had done this, you would have perfect 80%-calibration now."
          />
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdjustmentRecommendation
              adjustmentCurve={adjustmentCurve}
              sessionCount={stats?.predictionCount ?? 0}
            />
            <AdjustmentPlot adjustmentCurve={adjustmentCurve} />
          </section>

          {/* Session log */}
          <SectionHeader
            title="Session Log"
            subtitle="A raw record of every focus session. Use the filters below to sort and explore."
          />
          <div ref={sessionTableRef}>
            <SessionTable key={sessionSort} sessions={filteredSessions} initialSort={sessionSort} />
          </div>

          {/* Export */}
          <section className="text-center">
            <Text>Download all your predictions for further analysis</Text>
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
