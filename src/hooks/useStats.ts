import { useMemo } from 'react'
import type { Session } from '../lib/storage'
import type { TimeRange, Granularity, OnTimeResult, DurationBucket, CalibrationStats, AdjustmentCurve } from '../lib/stats'
import {
  filterByTimeRange,
  filterMeaningful,
  computeCalibrationStats,
  computeOnTimeRate,
  computeAdjustmentCurve,
  groupByPeriod,
  groupByDurationBucket,
  groupByWeekday,
  DURATION_BUCKETS,
} from '../lib/stats'

/** Filter sessions that are completed predictions (mode:predict) and meaningful (>= 15s) */
function predictionOnly(sessions: Session[]): Session[] {
  return filterMeaningful(sessions).filter(
    s => s.status === 'completed' && s.tags.includes('mode:predict')
  )
}

export function useFilteredSessions(sessions: Session[], timeRange: TimeRange): Session[] {
  return useMemo(() => filterByTimeRange(sessions, timeRange), [sessions, timeRange])
}

export function useOverallStats(sessions: Session[]): CalibrationStats | null {
  return useMemo(() => computeCalibrationStats(filterMeaningful(sessions)), [sessions])
}

export interface PeriodData {
  period: string
  onTime: OnTimeResult
  sessionCount: number
}

export function useCalibrationOverTime(sessions: Session[], granularity: Granularity): PeriodData[] {
  return useMemo(() => {
    const predictions = predictionOnly(sessions)
    const groups = groupByPeriod(predictions, granularity)
    const result: PeriodData[] = []
    for (const [period, groupSessions] of groups) {
      const onTime = computeOnTimeRate(groupSessions)
      if (onTime) result.push({ period, onTime, sessionCount: onTime.n })
    }
    result.sort((a, b) => a.period.localeCompare(b.period))
    return result
  }, [sessions, granularity])
}

export interface BucketData {
  bucket: DurationBucket
  onTime: OnTimeResult | null
  sessionCount: number
}

export function useByDurationBucket(sessions: Session[]): BucketData[] {
  return useMemo(() => {
    const predictions = predictionOnly(sessions)
    const groups = groupByDurationBucket(predictions)
    return DURATION_BUCKETS.map(bucket => {
      const groupSessions = groups.get(bucket) || []
      const onTime = computeOnTimeRate(groupSessions)
      return {
        bucket,
        onTime,
        sessionCount: onTime?.n ?? 0,
      }
    })
  }, [sessions])
}

export interface HeatmapDay {
  date: string
  onTimeRate: number | null
  sessionCount: number
}

export interface HeatmapWeekday {
  day: number
  onTimeRate: number | null
  sessionCount: number
}

export interface HeatmapData {
  days: HeatmapDay[]
  weekdays: HeatmapWeekday[]
}

export function useHeatmapData(sessions: Session[]): HeatmapData {
  return useMemo(() => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const recent = predictionOnly(sessions.filter(s => s.timestamp >= sixMonthsAgo))

    const dailyGroups = groupByPeriod(recent, 'day')
    const days: HeatmapDay[] = []
    for (const [dateKey, daySessions] of dailyGroups) {
      const onTime = computeOnTimeRate(daySessions)
      days.push({ date: dateKey, onTimeRate: onTime?.rate ?? null, sessionCount: onTime?.n ?? 0 })
    }

    const weekdayGroups = groupByWeekday(recent)
    const weekdays: HeatmapWeekday[] = []
    for (let d = 0; d < 7; d++) {
      const ws = weekdayGroups.get(d) || []
      const onTime = computeOnTimeRate(ws)
      weekdays.push({ day: d, onTimeRate: onTime?.rate ?? null, sessionCount: onTime?.n ?? 0 })
    }

    return { days, weekdays }
  }, [sessions])
}

export function useAdjustmentCurve(sessions: Session[]): AdjustmentCurve | null {
  return useMemo(() => computeAdjustmentCurve(filterMeaningful(sessions)), [sessions])
}

export interface PeriodComparison {
  currentRate: number | null
  previousRate: number | null
  currentN: number
  change: number | null // percentage point difference
}

export function usePeriodComparison(sessions: Session[], granularity: Granularity): PeriodComparison {
  return useMemo(() => {
    const predictions = predictionOnly(sessions)
    const now = new Date()

    let currentStart: Date
    let previousStart: Date

    if (granularity === 'day') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 1)
    } else if (granularity === 'week') {
      currentStart = new Date(now)
      currentStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
      currentStart.setHours(0, 0, 0, 0)
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 7)
    } else {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    }

    const current = predictions.filter(s => s.timestamp >= currentStart)
    const previous = predictions.filter(s => s.timestamp >= previousStart && s.timestamp < currentStart)

    const currentOnTime = computeOnTimeRate(current)
    const previousOnTime = computeOnTimeRate(previous)

    return {
      currentRate: currentOnTime?.rate ?? null,
      previousRate: previousOnTime?.rate ?? null,
      currentN: currentOnTime?.n ?? 0,
      change: currentOnTime && previousOnTime
        ? currentOnTime.rate - previousOnTime.rate
        : null,
    }
  }, [sessions, granularity])
}

export interface NotableSession {
  session: Session
  ratio: number // actual / predicted
  errorPercent: number // abs((actual - predicted) / predicted) * 100
}

export function useNotableSessions(sessions: Session[], limit = 5): {
  mostUnderestimated: NotableSession[]
  mostOverestimated: NotableSession[]
  bestCalibrated: NotableSession[]
} {
  return useMemo(() => {
    const predictions = predictionOnly(sessions)
    const scored: NotableSession[] = predictions.map(s => ({
      session: s,
      ratio: s.actualSeconds / s.predictedSeconds,
      errorPercent: Math.abs(s.actualSeconds - s.predictedSeconds) / s.predictedSeconds * 100,
    }))

    const sortedByRatio = [...scored].sort((a, b) => b.ratio - a.ratio)
    const sortedByError = [...scored].sort((a, b) => a.errorPercent - b.errorPercent)

    return {
      mostUnderestimated: sortedByRatio.slice(0, limit),
      mostOverestimated: sortedByRatio.slice(-limit).reverse(),
      bestCalibrated: sortedByError.slice(0, limit),
    }
  }, [sessions, limit])
}
