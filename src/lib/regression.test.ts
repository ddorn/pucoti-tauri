import { describe, it, expect } from 'vitest'
import { linearRegression } from './stats'

describe('linearRegression', () => {
  it('returns null for insufficient data', () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression([{ x: 1, y: 1 }])).toBeNull()
  })

  it('calculates perfect positive correlation', () => {
    const result = linearRegression([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(1, 5)
    expect(result!.intercept).toBeCloseTo(0, 5)
    expect(result!.rSquared).toBeCloseTo(1, 5)
  })

  it('calculates slope and intercept correctly', () => {
    // y = 2x + 1
    const result = linearRegression([
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(2, 5)
    expect(result!.intercept).toBeCloseTo(1, 5)
    expect(result!.rSquared).toBeCloseTo(1, 5)
  })

  it('handles noisy data', () => {
    const result = linearRegression([
      { x: 1, y: 2.1 },
      { x: 2, y: 3.9 },
      { x: 3, y: 6.2 },
      { x: 4, y: 7.8 },
      { x: 5, y: 10.1 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(2, 0.5)
    expect(result!.rSquared).toBeGreaterThan(0.9)
  })

  it('handles underestimation pattern', () => {
    // Actual > Predicted means slope > 1 (underestimation)
    const result = linearRegression([
      { x: 10, y: 15 },
      { x: 20, y: 28 },
      { x: 30, y: 42 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeGreaterThan(1)
  })

  it('handles overestimation pattern', () => {
    // Actual < Predicted means slope < 1 (overestimation)
    const result = linearRegression([
      { x: 10, y: 8 },
      { x: 20, y: 16 },
      { x: 30, y: 24 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeLessThan(1)
  })

  it('handles horizontal line', () => {
    const result = linearRegression([
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ])
    expect(result).not.toBeNull()
    expect(result!.slope).toBeCloseTo(0, 5)
    expect(result!.intercept).toBeCloseTo(5, 5)
  })

  it('handles vertical line (undefined slope)', () => {
    const result = linearRegression([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ])
    // Vertical line has undefined slope - denominator is 0
    expect(result).toBeNull()
  })
})
