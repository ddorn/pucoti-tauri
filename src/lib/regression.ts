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
