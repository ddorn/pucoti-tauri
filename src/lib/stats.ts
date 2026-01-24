import type { Session } from './storage'

export interface CalibrationStats {
  /** Mean bias as percentage (positive = underestimate, tasks took longer) */
  meanBias: number
  /** Half-width of 95% CI for meanBias, or null if not enough data */
  biasMargin: number | null
  /** Total seconds tracked */
  totalSeconds: number
  /** Percentage of sessions that took longer than predicted */
  longerPercent: number
  /** Percentage of estimates within ±10% of actual */
  withinTenPercent: number
  /** Number of completed sessions */
  sessionCount: number
}

/**
 * Compute calibration statistics from completed sessions.
 * Returns null if no completed sessions.
 */
export function computeCalibrationStats(sessions: Session[]): CalibrationStats | null {
  const completed = sessions.filter(s => s.status === 'completed')
  if (completed.length === 0) return null

  const n = completed.length

  // Bias: (actual - predicted) / predicted as percentage
  // Positive means tasks took longer than predicted (underestimate)
  const biases = completed.map(s =>
    ((s.actualSeconds - s.predictedSeconds) / s.predictedSeconds) * 100
  )
  const meanBias = biases.reduce((a, b) => a + b, 0) / n

  // 95% CI margin for mean bias (half-width)
  let biasMargin: number | null = null
  if (n >= 3) {
    const variance = biases.reduce((a, b) => a + (b - meanBias) ** 2, 0) / (n - 1)
    const se = Math.sqrt(variance / n)
    const tValue = n > 30 ? 1.96 : 2.0
    biasMargin = tValue * se
  }

  // Total time tracked
  const totalSeconds = completed.reduce((a, s) => a + s.actualSeconds, 0)

  // % sessions taking longer than predicted
  const longerCount = completed.filter(s => s.actualSeconds > s.predictedSeconds).length
  const longerPercent = (longerCount / n) * 100

  // % estimates within ±10%
  const withinCount = completed.filter(s => {
    const error = Math.abs(s.actualSeconds - s.predictedSeconds) / s.predictedSeconds
    return error <= 0.1
  }).length
  const withinTenPercent = (withinCount / n) * 100

  return {
    meanBias,
    biasMargin,
    totalSeconds,
    longerPercent,
    withinTenPercent,
    sessionCount: n,
  }
}

export interface RegressionWithCI {
  slope: number
  intercept: number
  rSquared: number
  /** 95% CI for slope, or null if not enough data */
  slopeCI: { low: number; high: number } | null
}

/**
 * Compute linear regression with confidence interval for slope.
 * Returns null if fewer than 2 points.
 */
export function computeRegressionWithCI(
  points: Array<{ x: number; y: number }>
): RegressionWithCI | null {
  const n = points.length
  if (n < 2) return null

  // Basic regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (const { x, y } of points) {
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // R²
  const meanY = sumY / n
  let ssTotal = 0, ssResidual = 0
  for (const { x, y } of points) {
    const predicted = slope * x + intercept
    ssTotal += (y - meanY) ** 2
    ssResidual += (y - predicted) ** 2
  }
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal

  // Confidence interval for slope (need at least 3 points)
  let slopeCI: { low: number; high: number } | null = null
  if (n >= 3) {
    const meanX = sumX / n
    const ssX = points.reduce((a, p) => a + (p.x - meanX) ** 2, 0)
    const mse = ssResidual / (n - 2)
    const seSlope = Math.sqrt(mse / ssX)
    const tValue = n > 30 ? 1.96 : 2.0
    slopeCI = {
      low: slope - tValue * seSlope,
      high: slope + tValue * seSlope,
    }
  }

  return { slope, intercept, rSquared, slopeCI }
}

export interface RegressionResult {
  slope: number
  intercept: number
  rSquared: number
}

/**
 * Simple linear regression: y = slope * x + intercept
 * Returns null if insufficient data (need at least 2 points)
 */
export function linearRegression(
  points: Array<{ x: number; y: number }>
): RegressionResult | null {
  const n = points.length
  if (n < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (const { x, y } of points) {
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
    sumY2 += y * y
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  // Calculate R²
  const meanY = sumY / n
  let ssTotal = 0
  let ssResidual = 0
  for (const { x, y } of points) {
    const predicted = slope * x + intercept
    ssTotal += (y - meanY) ** 2
    ssResidual += (y - predicted) ** 2
  }
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal

  return { slope, intercept, rSquared }
}
