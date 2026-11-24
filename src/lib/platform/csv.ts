/**
 * CSV helpers shared by Tauri and web platform implementations.
 */
import type { Session, SessionStatus } from '../session'

export function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

export const SESSIONS_CSV_HEADER = 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'

/** Sessions from a sessions CSV, header included. Rows with fewer than five fields are skipped. */
export function parseSessionsCSV(csv: string): Session[] {
  const lines = csv.trim().split('\n')
  const sessions: Session[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    if (fields.length < 5) continue

    const [timestamp, focusText, predictedSeconds, actualSeconds, status, tags = ''] = fields
    sessions.push({
      timestamp: new Date(timestamp),
      focusText,
      predictedSeconds: parseInt(predictedSeconds, 10),
      actualSeconds: parseInt(actualSeconds, 10),
      status: status as SessionStatus,
      tags: tags ? tags.split(';').map(t => t.trim()) : [],
    })
  }
  return sessions
}

/**
 * Identifies a session across exports. To the second, because the desktop CSV stores
 * timestamps to the second and the web keeps milliseconds.
 */
function sessionKey(session: Session): string {
  return `${Math.floor(session.timestamp.getTime() / 1000)}|${session.focusText}`
}

/**
 * The sessions of an imported CSV that are not stored yet, so importing the same file
 * twice, or a file exported from this very app, adds nothing. Rows that do not parse
 * are dropped rather than stored as junk.
 */
export function sessionsToImport(csv: string, existing: Session[]): { added: Session[]; skipped: number } {
  const seen = new Set(existing.map(sessionKey))
  const added: Session[] = []
  let skipped = 0
  for (const session of parseSessionsCSV(csv)) {
    const valid = !isNaN(session.timestamp.getTime())
      && !isNaN(session.predictedSeconds)
      && !isNaN(session.actualSeconds)
    const key = sessionKey(session)
    if (!valid || seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    added.push(session)
  }
  return { added, skipped }
}

/** Oldest first, which is the order the rest of the app expects. */
export function byTimestamp(a: Session, b: Session): number {
  return a.timestamp.getTime() - b.timestamp.getTime()
}
