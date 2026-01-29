import type { Session } from './storage'

export interface CalibrationStats {
  /** Mean bias as percentage (positive = underestimate, tasks took longer) */
  meanBias: number
  /** Half-width of 95% CI for meanBias, or null if not enough data */
  biasMargin: number | null
  /** Total seconds tracked across ALL completed sessions */
  totalSecondsTracked: number
  /** Count of ALL completed sessions */
  completedCount: number
  /** Percentage of sessions that took longer than predicted */
  longerPercent: number
  /** Percentage of estimates within ±10% of actual */
  withinTenPercent: number
  /** Count of mode:predict sessions (used for calibration statistics) */
  predictionCount: number
    /** Interquartile range of actual/predicted ratios */
    ratioIQR: { q1: number; median: number; q3: number; } | null;
}

/**
 * Compute calibration statistics from sessions.
 * Returns null if no prediction sessions.
 * Calibration stats (bias, accuracy) only use prediction sessions (excludes timebox and ai-ab).
 * Total time tracked includes ALL completed sessions regardless of mode.
 */
export function computeCalibrationStats(sessions: Session[]): CalibrationStats | null {
  // All completed sessions for total time tracking
  const allCompleted = sessions.filter(s => s.status === 'completed')

  // Only prediction sessions for calibration statistics
  const predictionSessions = allCompleted.filter(s => s.tags.includes('mode:predict'))

  if (predictionSessions.length === 0) return null

  const n = predictionSessions.length

  // Bias: (actual - predicted) / predicted as percentage
  // Positive means tasks took longer than predicted (underestimate)
  const biases = predictionSessions.map(s =>
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

  // Total time tracked across ALL completed sessions
  const totalSecondsTracked = allCompleted.reduce((a, s) => a + s.actualSeconds, 0)

  // % sessions taking longer than predicted (prediction sessions only)
  const longerCount = predictionSessions.filter(s => s.actualSeconds > s.predictedSeconds).length
  const longerPercent = (longerCount / n) * 100

  // % estimates within ±10% (prediction sessions only)
  const withinCount = predictionSessions.filter(s => {
    const error = Math.abs(s.actualSeconds - s.predictedSeconds) / s.predictedSeconds
    return error <= 0.1
  }).length
  const withinTenPercent = (withinCount / n) * 100

    // Interquartile range of actual/predicted ratios (prediction sessions only)
    let ratioIQR: { q1: number; median: number; q3: number; } | null = null;
    if (n >= 3) {
        const ratios = predictionSessions
            .map(s => s.actualSeconds / s.predictedSeconds)
            .sort((a, b) => a - b);

        const q1Index = Math.floor(n * 0.25);
        const medianIndex = Math.floor(n * 0.5);
        const q3Index = Math.floor(n * 0.75);

        ratioIQR = {
            q1: ratios[q1Index],
            median: ratios[medianIndex],
            q3: ratios[q3Index],
        };
    }

  return {
    meanBias,
    biasMargin,
    totalSecondsTracked,
    completedCount: allCompleted.length,
    longerPercent,
    withinTenPercent,
    predictionCount: n,
      ratioIQR,
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

export interface AdjustmentCurve {
    /** Adjustment percentages (x-axis) */
    adjustments: number[];
    /** On-time rate for each adjustment (y-axis) */
    onTimeRates: number[];
    /** Adjustment percentage needed for 80% on-time rate */
    adjustment80: number | null;
}

/**
 * Compute the adjustment curve: for each adjustment percentage,
 * calculate what proportion of sessions would be "on time" (actual < predicted * multiplier).
 * Also finds the specific adjustment needed for 80% on-time rate.
 * Only includes prediction sessions (excludes timebox and ai-ab).
 */
export function computeAdjustmentCurve(sessions: Session[]): AdjustmentCurve | null {
  const completed = sessions.filter(s =>
    s.status === 'completed' && s.tags.includes('mode:predict')
  );
    if (completed.length === 0) return null;

    // Generate adjustment percentages from -50% to +200%
    const adjustments: number[] = [];
    for (let adj = -50; adj <= 200; adj += 2) {
        adjustments.push(adj);
    }

    const onTimeRates: number[] = [];

    for (const adj of adjustments) {
        const multiplier = 1 + adj / 100;
        const onTimeCount = completed.filter(s =>
            s.actualSeconds <= s.predictedSeconds * multiplier
        ).length;
        const onTimeRate = (onTimeCount / completed.length) * 100;
        onTimeRates.push(onTimeRate);
    }

    // Find adjustment for 80% on-time using interpolation
    let adjustment80: number | null = null;
    for (let i = 0; i < onTimeRates.length - 1; i++) {
        const rate1 = onTimeRates[i];
        const rate2 = onTimeRates[i + 1];

        if ((rate1 <= 80 && rate2 >= 80) || (rate1 >= 80 && rate2 <= 80)) {
            const adj1 = adjustments[i];
            const adj2 = adjustments[i + 1];

            // Linear interpolation
            if (rate2 !== rate1) {
                adjustment80 = adj1 + ((80 - rate1) / (rate2 - rate1)) * (adj2 - adj1);
            } else {
                adjustment80 = adj1;
            }
            break;
        }
    }

    return {
        adjustments,
        onTimeRates,
        adjustment80,
    };
}
