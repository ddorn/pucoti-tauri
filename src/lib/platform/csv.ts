/**
 * CSV helpers shared by Tauri and web platform implementations.
 */

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

/**
 * Column order of sessions.csv. `focus_seconds` was appended when stacked timers
 * landed: rows written before that have one fewer field, and are read back with
 * focusSeconds defaulting to actualSeconds (nothing could have been held).
 */
export const CSV_HEADER =
  'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags,focus_seconds'

/** Parse one data row. Returns null for rows too short to be a session. */
export function parseSessionFields(fields: string[]): {
  timestamp: string
  focusText: string
  predictedSeconds: number
  actualSeconds: number
  focusSeconds: number
  status: string
  tags: string[]
} | null {
  if (fields.length < 5) return null
  const [timestamp, focusText, predictedSeconds, actualSeconds, status, tags = '', focusSeconds = ''] =
    fields
  const actual = parseInt(actualSeconds, 10)
  const focus = parseInt(focusSeconds, 10)
  return {
    timestamp,
    focusText,
    predictedSeconds: parseInt(predictedSeconds, 10),
    actualSeconds: actual,
    focusSeconds: Number.isNaN(focus) ? actual : focus,
    status,
    tags: tags ? tags.split(';').map(t => t.trim()) : [],
  }
}

/** Serialize a session to one CSV row, in CSV_HEADER order. */
export function serializeSessionRow(fields: {
  timestamp: string
  focusText: string
  predictedSeconds: number
  actualSeconds: number
  focusSeconds: number
  status: string
  tags: string[]
}): string {
  return [
    fields.timestamp,
    escapeCSV(fields.focusText),
    fields.predictedSeconds.toString(),
    fields.actualSeconds.toString(),
    fields.status,
    fields.tags.join(';'),
    fields.focusSeconds.toString(),
  ].join(',')
}
