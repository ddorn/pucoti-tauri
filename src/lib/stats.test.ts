import { describe, it, expect } from 'vitest'
import {
  computeOnTimeRate,
  filterByTimeRange,
  groupByPeriod,
  groupByDurationBucket,
  calibrationColor,
  DURATION_BUCKETS,
} from './stats'
import type { Session } from './storage'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    timestamp: new Date('2026-03-01T12:00:00'),
    focusText: 'test',
    predictedSeconds: 600,
    actualSeconds: 600,
    status: 'completed',
    tags: ['mode:predict'],
    ...overrides,
  }
}

describe('computeOnTimeRate', () => {
  it('returns null for empty input', () => {
    expect(computeOnTimeRate([])).toBeNull()
  })

  it('returns null for non-prediction sessions', () => {
    expect(computeOnTimeRate([makeSession({ tags: ['mode:timebox'] })])).toBeNull()
  })

  it('returns null for non-completed sessions', () => {
    expect(computeOnTimeRate([makeSession({ status: 'canceled' })])).toBeNull()
  })

  it('returns 100% when all sessions are on time', () => {
    const sessions = [
      makeSession({ predictedSeconds: 600, actualSeconds: 500 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 600 }),
    ]
    const result = computeOnTimeRate(sessions)!
    expect(result.rate).toBe(100)
    expect(result.n).toBe(2)
  })

  it('returns 0% when no sessions are on time', () => {
    const sessions = [
      makeSession({ predictedSeconds: 600, actualSeconds: 700 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 800 }),
    ]
    const result = computeOnTimeRate(sessions)!
    expect(result.rate).toBe(0)
    expect(result.n).toBe(2)
  })

  it('computes correct rate for mixed sessions', () => {
    const sessions = [
      makeSession({ predictedSeconds: 600, actualSeconds: 500 }), // on time
      makeSession({ predictedSeconds: 600, actualSeconds: 700 }), // late
      makeSession({ predictedSeconds: 600, actualSeconds: 600 }), // on time (equal)
    ]
    const result = computeOnTimeRate(sessions)!
    expect(result.rate).toBeCloseTo(66.67, 1)
    expect(result.n).toBe(3)
  })

  it('Wilson CI bounds are within [0, 100]', () => {
    const sessions = [makeSession()]
    const result = computeOnTimeRate(sessions)!
    expect(result.ci95Low).toBeGreaterThanOrEqual(0)
    expect(result.ci95High).toBeLessThanOrEqual(100)
  })

  it('Wilson CI narrows with more data', () => {
    const few = Array.from({ length: 3 }, () =>
      makeSession({ predictedSeconds: 600, actualSeconds: 500 })
    )
    const many = Array.from({ length: 30 }, () =>
      makeSession({ predictedSeconds: 600, actualSeconds: 500 })
    )
    const fewResult = computeOnTimeRate(few)!
    const manyResult = computeOnTimeRate(many)!
    const fewWidth = fewResult.ci95High - fewResult.ci95Low
    const manyWidth = manyResult.ci95High - manyResult.ci95Low
    expect(manyWidth).toBeLessThan(fewWidth)
  })

  it('CI contains the point estimate', () => {
    const sessions = [
      makeSession({ predictedSeconds: 600, actualSeconds: 500 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 700 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 600 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 400 }),
      makeSession({ predictedSeconds: 600, actualSeconds: 800 }),
    ]
    const result = computeOnTimeRate(sessions)!
    expect(result.ci95Low).toBeLessThanOrEqual(result.rate)
    expect(result.ci95High).toBeGreaterThanOrEqual(result.rate)
  })
})

describe('filterByTimeRange', () => {
  const old = makeSession({ timestamp: new Date('2025-01-01') })
  const recent = makeSession({ timestamp: new Date('2026-02-15') })
  const veryRecent = makeSession({ timestamp: new Date('2026-03-01') })
  const sessions = [old, recent, veryRecent]

  it('returns all sessions for "all"', () => {
    expect(filterByTimeRange(sessions, 'all')).toEqual(sessions)
  })

  it('filters to last month', () => {
    const result = filterByTimeRange(sessions, '1m')
    expect(result).toContain(veryRecent)
    expect(result).not.toContain(old)
  })

  it('filters to last 6 months', () => {
    const result = filterByTimeRange(sessions, '6m')
    expect(result).toContain(recent)
    expect(result).toContain(veryRecent)
    expect(result).not.toContain(old)
  })
})

describe('groupByPeriod', () => {
  it('groups by day', () => {
    const sessions = [
      makeSession({ timestamp: new Date('2026-03-01T10:00:00') }),
      makeSession({ timestamp: new Date('2026-03-01T14:00:00') }),
      makeSession({ timestamp: new Date('2026-03-02T10:00:00') }),
    ]
    const groups = groupByPeriod(sessions, 'day')
    expect(groups.get('2026-03-01')?.length).toBe(2)
    expect(groups.get('2026-03-02')?.length).toBe(1)
  })

  it('groups by month', () => {
    const sessions = [
      makeSession({ timestamp: new Date('2026-03-01') }),
      makeSession({ timestamp: new Date('2026-03-15') }),
      makeSession({ timestamp: new Date('2026-04-01') }),
    ]
    const groups = groupByPeriod(sessions, 'month')
    expect(groups.get('2026-03')?.length).toBe(2)
    expect(groups.get('2026-04')?.length).toBe(1)
  })

  it('groups by week', () => {
    // 2026-03-02 is a Monday (week 10), 2026-03-09 is next Monday (week 11)
    const sessions = [
      makeSession({ timestamp: new Date('2026-03-02') }),
      makeSession({ timestamp: new Date('2026-03-04') }),
      makeSession({ timestamp: new Date('2026-03-09') }),
    ]
    const groups = groupByPeriod(sessions, 'week')
    expect(groups.size).toBe(2)
  })
})

describe('groupByDurationBucket', () => {
  it('assigns to correct buckets', () => {
    const sessions = [
      makeSession({ predictedSeconds: 60 }),    // <5m
      makeSession({ predictedSeconds: 600 }),   // 5-15m
      makeSession({ predictedSeconds: 1200 }),  // 15-30m
      makeSession({ predictedSeconds: 2400 }),  // 30m-1h
      makeSession({ predictedSeconds: 7200 }),  // >1h
    ]
    const groups = groupByDurationBucket(sessions)
    expect(groups.get('<5m')?.length).toBe(1)
    expect(groups.get('5-15m')?.length).toBe(1)
    expect(groups.get('15-30m')?.length).toBe(1)
    expect(groups.get('30m-1h')?.length).toBe(1)
    expect(groups.get('>1h')?.length).toBe(1)
  })

  it('initializes all buckets even if empty', () => {
    const groups = groupByDurationBucket([])
    for (const bucket of DURATION_BUCKETS) {
      expect(groups.has(bucket)).toBe(true)
      expect(groups.get(bucket)?.length).toBe(0)
    }
  })

  it('handles boundary values correctly', () => {
    const groups = groupByDurationBucket([
      makeSession({ predictedSeconds: 299 }),  // <5m
      makeSession({ predictedSeconds: 300 }),  // 5-15m (boundary)
      makeSession({ predictedSeconds: 899 }),  // 5-15m
      makeSession({ predictedSeconds: 900 }),  // 15-30m (boundary)
      makeSession({ predictedSeconds: 3599 }), // 30m-1h
      makeSession({ predictedSeconds: 3600 }), // >1h (boundary)
    ])
    expect(groups.get('<5m')?.length).toBe(1)
    expect(groups.get('5-15m')?.length).toBe(2)
    expect(groups.get('15-30m')?.length).toBe(1)
    expect(groups.get('30m-1h')?.length).toBe(1)
    expect(groups.get('>1h')?.length).toBe(1)
  })
})

describe('calibrationColor', () => {
  it('returns gray for null', () => {
    expect(calibrationColor(null)).toBe('#3f3f46')
  })

  it('returns red at 0%', () => {
    expect(calibrationColor(0)).toBe('#ef4444')
  })

  it('returns red at 30%', () => {
    expect(calibrationColor(30)).toBe('#ef4444')
  })

  it('returns green at 80%', () => {
    expect(calibrationColor(80)).toBe('#22c55e')
  })

  it('returns golden at 100%', () => {
    expect(calibrationColor(100)).toBe('#eab308')
  })

  it('interpolates between red and green', () => {
    const color = calibrationColor(55)
    // Should be somewhere between red and green, not equal to either
    expect(color).not.toBe('#ef4444')
    expect(color).not.toBe('#22c55e')
  })

  it('interpolates between green and golden', () => {
    const color = calibrationColor(90)
    expect(color).not.toBe('#22c55e')
    expect(color).not.toBe('#eab308')
  })

  it('clamps values below 0 and above 100', () => {
    expect(calibrationColor(-10)).toBe('#ef4444')
    expect(calibrationColor(110)).toBe('#eab308')
  })
})
