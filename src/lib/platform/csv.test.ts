import { describe, it, expect } from 'vitest'
import { CSV_HEADER, parseCSVLine, parseSessionFields, serializeSessionRow } from './csv'

const fields = {
  timestamp: '2026-09-01 14:03:22',
  focusText: 'Write the intro',
  predictedSeconds: 1500,
  actualSeconds: 2700,
  focusSeconds: 1620,
  status: 'completed',
  tags: ['mode:predict'],
}

describe('parseSessionFields', () => {
  it('reads a row written with focus_seconds', () => {
    const row = serializeSessionRow(fields)
    expect(parseSessionFields(parseCSVLine(row))).toEqual(fields)
  })

  it('defaults focusSeconds to actualSeconds on rows written before stacked timers', () => {
    const legacy = '2026-09-01 14:03:22,Write the intro,1500,2700,completed,mode:predict'
    const parsed = parseSessionFields(parseCSVLine(legacy))
    expect(parsed?.focusSeconds).toBe(2700)
    expect(parsed?.actualSeconds).toBe(2700)
  })

  it('defaults focusSeconds when the field is present but empty', () => {
    const row = '2026-09-01 14:03:22,Write the intro,1500,2700,completed,mode:predict,'
    expect(parseSessionFields(parseCSVLine(row))?.focusSeconds).toBe(2700)
  })

  it('survives commas and quotes in the intent', () => {
    const row = serializeSessionRow({ ...fields, focusText: 'Reply to "Marc", then ship' })
    expect(parseSessionFields(parseCSVLine(row))?.focusText).toBe('Reply to "Marc", then ship')
  })

  it('rejects rows that are too short to be a session', () => {
    expect(parseSessionFields(parseCSVLine('2026-09-01 14:03:22,oops,1500'))).toBeNull()
  })

  it('handles an empty tags column', () => {
    const row = serializeSessionRow({ ...fields, tags: [] })
    expect(parseSessionFields(parseCSVLine(row))?.tags).toEqual([])
  })
})

describe('CSV_HEADER', () => {
  it('matches the column order rows are written in', () => {
    const row = serializeSessionRow(fields)
    expect(parseCSVLine(row)).toHaveLength(CSV_HEADER.split(',').length)
  })
})
