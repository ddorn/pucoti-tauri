import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { formatTimestamp } from './format'
import { getDataDir } from './paths'

export type SessionStatus = 'completed' | 'canceled' | 'unknown'

export interface Session {
  timestamp: Date
  focusText: string
  predictedSeconds: number
  actualSeconds: number
  status: SessionStatus
  tags: string[]
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function parseCSVLine(line: string): string[] {
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

export async function getCSVPath(): Promise<string> {
  const dir = await getDataDir()
  const path = await resolve(dir, 'sessions.csv')
  return path
}

export async function loadSessions(): Promise<Session[]> {
  const csvPath = await getCSVPath()
  let content: string
  try {
    content = await readTextFile(csvPath)
  } catch (err) {
    console.error('Failed to read sessions CSV (returning empty array):', err)
    return []
  }

  const lines = content.trim().split('\n')
  if (lines.length <= 1) return [] // Only header or empty

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

export async function appendSession(session: Session): Promise<void> {
  const csvPath = await getCSVPath()

  // Check if file exists, if not write header
  let fileExists = await exists(csvPath)

  const line = [
    formatTimestamp(session.timestamp),
    escapeCSV(session.focusText),
    session.predictedSeconds.toString(),
    session.actualSeconds.toString(),
    session.status,
    session.tags.join(';'),
  ].join(',')

  if (!fileExists) {
    const header = 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'
    await writeTextFile(csvPath, header + line + '\n')
  } else {
    await writeTextFile(csvPath, line + '\n', { append: true })
  }
}

export async function exportSessionsCSV(): Promise<string> {
  const csvPath = await getCSVPath()
  try {
    return await readTextFile(csvPath)
  } catch (err) {
    console.error('Failed to read CSV for export (returning header only):', err)
    return 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'
  }
}
