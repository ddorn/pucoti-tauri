import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { formatTimestamp } from '../../format'
import { getDataDir } from './paths'
import type { Session, SessionStatus } from '../../session'
import { CSV_HEADER, parseCSVLine, parseSessionFields, serializeSessionRow } from '../csv'

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
  if (lines.length <= 1) return []

  const sessions: Session[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseSessionFields(parseCSVLine(line))
    if (!fields) continue

    sessions.push({
      ...fields,
      timestamp: new Date(fields.timestamp),
      status: fields.status as SessionStatus,
    })
  }

  return sessions
}

/**
 * Files written before `focus_seconds` existed still carry the old header, and rows are
 * only ever appended - so the header is brought up to date once per run, in place.
 */
let headerChecked = false

async function ensureHeader(csvPath: string): Promise<void> {
  if (headerChecked) return
  headerChecked = true

  const content = await readTextFile(csvPath)
  const newline = content.indexOf('\n')
  const header = (newline === -1 ? content : content.slice(0, newline)).trim()
  if (header === CSV_HEADER) return

  const rest = newline === -1 ? '' : content.slice(newline + 1)
  await writeTextFile(csvPath, CSV_HEADER + '\n' + rest)
}

export async function appendSession(session: Session): Promise<void> {
  const csvPath = await getCSVPath()

  const line = serializeSessionRow({
    ...session,
    timestamp: formatTimestamp(session.timestamp),
  })

  if (await exists(csvPath)) {
    await ensureHeader(csvPath)
    await writeTextFile(csvPath, line + '\n', { append: true })
  } else {
    headerChecked = true
    await writeTextFile(csvPath, CSV_HEADER + '\n' + line + '\n')
  }
}

export async function exportSessionsCSV(): Promise<string> {
  const csvPath = await getCSVPath()
  try {
    return await readTextFile(csvPath)
  } catch (err) {
    console.error('Failed to read CSV for export (returning header only):', err)
    return CSV_HEADER + '\n'
  }
}
