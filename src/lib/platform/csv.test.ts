import { describe, it, expect } from 'vitest'
import { parseSessionsCSV, sessionsToImport, escapeCSV, SESSIONS_CSV_HEADER } from './csv'
import type { Session } from '../session'

function session(overrides: Partial<Session> = {}): Session {
  return {
    timestamp: new Date('2026-03-01T10:00:00Z'),
    focusText: 'write the report',
    predictedSeconds: 600,
    actualSeconds: 720,
    status: 'completed',
    tags: [],
    ...overrides,
  }
}

describe('parseSessionsCSV', () => {
  it('reads quoted fields and tags', () => {
    const csv = SESSIONS_CSV_HEADER + `2026-03-01T10:00:00.000Z,${escapeCSV('a, "b"')},600,720,completed,work;deep\n`
    const [s] = parseSessionsCSV(csv)
    expect(s.focusText).toBe('a, "b"')
    expect(s.tags).toEqual(['work', 'deep'])
    expect(s.timestamp.toISOString()).toBe('2026-03-01T10:00:00.000Z')
  })

  it('returns nothing for a header-only file', () => {
    expect(parseSessionsCSV(SESSIONS_CSV_HEADER)).toEqual([])
  })
})

describe('sessionsToImport', () => {
  it('skips sessions already stored, ignoring milliseconds', () => {
    const csv = SESSIONS_CSV_HEADER
      + '2026-03-01T10:00:00.000Z,write the report,600,720,completed,\n'
      + '2026-03-01T11:00:00.000Z,review,300,200,completed,\n'
    const existing = [session({ timestamp: new Date('2026-03-01T10:00:00.456Z') })]
    const { added, skipped } = sessionsToImport(csv, existing)
    expect(added.map(s => s.focusText)).toEqual(['review'])
    expect(skipped).toBe(1)
  })

  it('skips duplicates within the file itself', () => {
    const row = '2026-03-01T11:00:00.000Z,review,300,200,completed,\n'
    const { added, skipped } = sessionsToImport(SESSIONS_CSV_HEADER + row + row, [])
    expect(added).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('drops rows that do not parse', () => {
    const csv = SESSIONS_CSV_HEADER
      + 'not a date,review,300,200,completed,\n'
      + '2026-03-01T11:00:00.000Z,review,abc,200,completed,\n'
    expect(sessionsToImport(csv, [])).toEqual({ added: [], skipped: 2 })
  })
})
