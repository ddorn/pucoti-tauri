import { describe, it, expect } from 'vitest'
import { parseTime, formatTimePreview } from './time-parser'

describe('parseTime', () => {
  it('returns null for empty input', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime('   ')).toBeNull()
  })

  it('parses plain numbers as minutes', () => {
    expect(parseTime('12')).toBe(720)
    expect(parseTime('1')).toBe(60)
    expect(parseTime('90')).toBe(5400)
    expect(parseTime('1.5')).toBe(90)
  })

  it('parses minutes format', () => {
    expect(parseTime('12m')).toBe(720)
    expect(parseTime('12min')).toBe(720)
    expect(parseTime('12 min')).toBe(720)
    expect(parseTime('12minutes')).toBe(720)
    expect(parseTime('1.5m')).toBe(90)
  })

  it('parses seconds format', () => {
    expect(parseTime('90s')).toBe(90)
    expect(parseTime('90sec')).toBe(90)
    expect(parseTime('90 seconds')).toBe(90)
  })

  it('parses hours format', () => {
    expect(parseTime('1h')).toBe(3600)
    expect(parseTime('1hour')).toBe(3600)
    expect(parseTime('2 hours')).toBe(7200)
    expect(parseTime('1.5h')).toBe(5400)
  })

  it('parses compound formats', () => {
    expect(parseTime('12m 30s')).toBe(750)
    expect(parseTime('1h 30m')).toBe(5400)
    expect(parseTime('1h 30m 45s')).toBe(5445)
    expect(parseTime('1h30m')).toBe(5400)
    expect(parseTime('2h 15m')).toBe(8100)
  })

  it('parses mm:ss colon format', () => {
    expect(parseTime('12:30')).toBe(750)
    expect(parseTime('1:00')).toBe(60)
    expect(parseTime('45:00')).toBe(2700)
    expect(parseTime('0:30')).toBe(30)
  })

  it('parses h:mm:ss colon format', () => {
    expect(parseTime('1:30:00')).toBe(5400)
    expect(parseTime('2:00:00')).toBe(7200)
    expect(parseTime('1:15:30')).toBe(4530)
  })

  it('returns null for invalid colon format', () => {
    expect(parseTime('12:60')).toBeNull() // 60 seconds invalid
    expect(parseTime('1:60:00')).toBeNull() // 60 minutes invalid
    expect(parseTime('1:30:60')).toBeNull() // 60 seconds invalid
  })

  it('is case insensitive', () => {
    expect(parseTime('12M')).toBe(720)
    expect(parseTime('1H 30M')).toBe(5400)
    expect(parseTime('90S')).toBe(90)
  })

  it('returns null for invalid input', () => {
    expect(parseTime('abc')).toBeNull()
    expect(parseTime('12x')).toBeNull()
    expect(parseTime('hello world')).toBeNull()
  })
})

describe('formatTimePreview', () => {
  it('formats seconds', () => {
    expect(formatTimePreview(30)).toBe('30 seconds')
    expect(formatTimePreview(1)).toBe('1 second')
  })

  it('formats minutes', () => {
    expect(formatTimePreview(60)).toBe('1 minute')
    expect(formatTimePreview(120)).toBe('2 minutes')
    expect(formatTimePreview(90)).toBe('1 minute 30 seconds')
  })

  it('formats hours', () => {
    expect(formatTimePreview(3600)).toBe('1 hour')
    expect(formatTimePreview(7200)).toBe('2 hours')
    expect(formatTimePreview(5400)).toBe('1 hour 30 minutes')
  })

  it('formats complex durations', () => {
    expect(formatTimePreview(3661)).toBe('1 hour 1 minute')
    expect(formatTimePreview(7320)).toBe('2 hours 2 minutes')
  })

  it('omits seconds for hour+ durations', () => {
    // Implementation intentionally omits seconds when hours > 0 for cleaner output
    expect(formatTimePreview(3630)).toBe('1 hour') // 1h 0m 30s -> "1 hour"
    expect(formatTimePreview(3690)).toBe('1 hour 1 minute') // 1h 1m 30s -> "1 hour 1 minute"
  })
})
