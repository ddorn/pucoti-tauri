import type { Session } from './storage'

// ── Types ──

export type TimeRange = '1m' | '3m' | '6m' | 'all'
export type Granularity = 'day' | 'week' | 'month'

export const DURATION_BUCKETS = ['<5m', '5-15m', '15-30m', '30m-1h', '>1h'] as const

export const GRANULARITY_LABELS: Record<Granularity, { singular: string; thisLabel: string; lastLabel: string }> = {
  day: { singular: 'day', thisLabel: 'Today', lastLabel: 'yesterday' },
  week: { singular: 'week', thisLabel: 'This week', lastLabel: 'last week' },
  month: { singular: 'month', thisLabel: 'This month', lastLabel: 'last month' },
}
export type DurationBucket = typeof DURATION_BUCKETS[number]

export interface OnTimeResult {
  /** On-time rate as percentage (0-100) */
  rate: number
  /** Lower bound of 95% Wilson CI (0-100) */
  ci95Low: number
  /** Upper bound of 95% Wilson CI (0-100) */
  ci95High: number
  /** Number of prediction sessions */
  n: number
}

export interface CalibrationStats {
  /** Total seconds tracked across ALL completed sessions */
  totalSecondsTracked: number
  /** Count of ALL completed sessions */
  completedCount: number
  /** Count of mode:predict sessions */
  predictionCount: number
  /** On-time rate with Wilson CI */
  onTimeRate: OnTimeResult | null
  /** Percentage of sessions that took longer than predicted */
  longerPercent: number
  /** Percentage of estimates within ±10% of actual */
  withinTenPercent: number
}

export interface AdjustmentCurve {
  /** Adjustment percentages (x-axis) */
  adjustments: number[]
  /** On-time rate for each adjustment (y-axis) */
  onTimeRates: number[]
  /** Adjustment percentage needed for 80% on-time rate */
  adjustment80: number | null
}

// ── Filtering ──

/** Minimum seconds for a session to be considered meaningful (not a mistake/test) */
const MIN_SESSION_SECONDS = 15

/** Filter out sessions that are likely mistakes (< 15 seconds predicted or actual) */
export function filterMeaningful(sessions: Session[]): Session[] {
  return sessions.filter(s =>
    s.predictedSeconds >= MIN_SESSION_SECONDS && s.actualSeconds >= MIN_SESSION_SECONDS
  )
}

export function filterByTimeRange(sessions: Session[], range: TimeRange): Session[] {
  if (range === 'all') return sessions
  const now = new Date()
  const months = { '1m': 1, '3m': 3, '6m': 6 }[range]
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return sessions.filter(s => s.timestamp >= cutoff)
}

// ── Grouping ──

function getPeriodKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')

  switch (granularity) {
    case 'day':
      return `${y}-${m}-${d}`
    case 'week':
      return getISOWeekKey(date)
    case 'month':
      return `${y}-${m}`
  }
}

function getISOWeekKey(date: Date): string {
  // ISO 8601 week: week containing Thursday determines the year
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function groupByPeriod(sessions: Session[], granularity: Granularity): Map<string, Session[]> {
  const groups = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = getPeriodKey(s.timestamp, granularity)
    const group = groups.get(key)
    if (group) {
      group.push(s)
    } else {
      groups.set(key, [s])
    }
  }
  return groups
}

function getDurationBucket(predictedSeconds: number): DurationBucket {
  if (predictedSeconds < 300) return '<5m'
  if (predictedSeconds < 900) return '5-15m'
  if (predictedSeconds < 1800) return '15-30m'
  if (predictedSeconds < 3600) return '30m-1h'
  return '>1h'
}

export function groupByDurationBucket(sessions: Session[]): Map<DurationBucket, Session[]> {
  const groups = new Map<DurationBucket, Session[]>()
  for (const bucket of DURATION_BUCKETS) {
    groups.set(bucket, [])
  }
  for (const s of sessions) {
    const bucket = getDurationBucket(s.predictedSeconds)
    groups.get(bucket)!.push(s)
  }
  return groups
}

export function groupByWeekday(sessions: Session[]): Map<number, Session[]> {
  const groups = new Map<number, Session[]>()
  for (let d = 0; d < 7; d++) groups.set(d, [])
  for (const s of sessions) {
    groups.get(s.timestamp.getDay())!.push(s)
  }
  return groups
}

// ── Metrics ──

/**
 * Compute on-time rate with Wilson score confidence interval.
 * Only considers completed prediction sessions (mode:predict).
 * Returns null if no qualifying sessions.
 */
export function computeOnTimeRate(sessions: Session[]): OnTimeResult | null {
  const prediction = sessions.filter(
    s => s.status === 'completed' && s.tags.includes('mode:predict')
  )
  const n = prediction.length
  if (n === 0) return null

  const successes = prediction.filter(s => s.actualSeconds <= s.predictedSeconds).length
  const p = successes / n

  // Wilson score interval for binomial proportion
  const z = 1.96
  const z2 = z * z
  const denominator = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denominator
  const margin = (z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denominator

  return {
    rate: p * 100,
    ci95Low: Math.max(0, center - margin) * 100,
    ci95High: Math.min(1, center + margin) * 100,
    n,
  }
}

/**
 * Compute calibration statistics from sessions.
 * Returns null if no prediction sessions.
 */
export function computeCalibrationStats(sessions: Session[]): CalibrationStats | null {
  const allCompleted = sessions.filter(s => s.status === 'completed')
  const predictionSessions = allCompleted.filter(s => s.tags.includes('mode:predict'))

  if (predictionSessions.length === 0) return null

  const n = predictionSessions.length
  const totalSecondsTracked = allCompleted.reduce((a, s) => a + s.actualSeconds, 0)

  const longerCount = predictionSessions.filter(s => s.actualSeconds > s.predictedSeconds).length
  const longerPercent = (longerCount / n) * 100

  const withinCount = predictionSessions.filter(s => {
    const error = Math.abs(s.actualSeconds - s.predictedSeconds) / s.predictedSeconds
    return error <= 0.1
  }).length
  const withinTenPercent = (withinCount / n) * 100

  return {
    totalSecondsTracked,
    completedCount: allCompleted.length,
    predictionCount: n,
    onTimeRate: computeOnTimeRate(sessions),
    longerPercent,
    withinTenPercent,
  }
}

// ── Color Scale ──

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t))
}

const COLOR_RED = '#ef4444'
const COLOR_GREEN = '#22c55e'
const COLOR_GOLDEN = '#eab308'
const COLOR_NONE = '#3f3f46'

/**
 * Map on-time rate to a color:
 * <=30% red, 80% green, 100% golden.
 * null (no data) returns gray.
 */
export function calibrationColor(onTimeRate: number | null): string {
  if (onTimeRate === null) return COLOR_NONE
  const rate = Math.max(0, Math.min(100, onTimeRate))

  if (rate <= 30) return COLOR_RED
  if (rate <= 80) {
    const t = (rate - 30) / 50
    return lerpColor(COLOR_RED, COLOR_GREEN, t)
  }
  const t = (rate - 80) / 20
  return lerpColor(COLOR_GREEN, COLOR_GOLDEN, t)
}

// ── Adjustment Curve ──

/**
 * Compute the adjustment curve: for each adjustment percentage,
 * calculate what proportion of sessions would be "on time".
 * Also finds the specific adjustment needed for 80% on-time rate.
 * Only includes prediction sessions (excludes timebox and ai-ab).
 */
export function computeAdjustmentCurve(sessions: Session[]): AdjustmentCurve | null {
  const completed = sessions.filter(s =>
    s.status === 'completed' && s.tags.includes('mode:predict')
  )
  if (completed.length === 0) return null

  const adjustments: number[] = []
  for (let adj = -100; adj <= 200; adj += 2) {
    adjustments.push(adj)
  }

  const onTimeRates: number[] = []
  for (const adj of adjustments) {
    const multiplier = 1 + adj / 100
    const onTimeCount = completed.filter(s =>
      s.actualSeconds <= s.predictedSeconds * multiplier
    ).length
    onTimeRates.push((onTimeCount / completed.length) * 100)
  }

  let adjustment80: number | null = null
  for (let i = 0; i < onTimeRates.length - 1; i++) {
    const rate1 = onTimeRates[i]
    const rate2 = onTimeRates[i + 1]
    if ((rate1 <= 80 && rate2 >= 80) || (rate1 >= 80 && rate2 <= 80)) {
      const adj1 = adjustments[i]
      const adj2 = adjustments[i + 1]
      if (rate2 !== rate1) {
        adjustment80 = adj1 + ((80 - rate1) / (rate2 - rate1)) * (adj2 - adj1)
      } else {
        adjustment80 = adj1
      }
      break
    }
  }

  return { adjustments, onTimeRates, adjustment80 }
}
