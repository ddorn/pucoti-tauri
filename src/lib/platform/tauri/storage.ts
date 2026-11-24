import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs'
import { formatTimestamp } from '../../format'
import { getDataDir } from './paths'
import type { Session } from '../../session'
import { escapeCSV, parseSessionsCSV, sessionsToImport, byTimestamp, SESSIONS_CSV_HEADER } from '../csv'

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
  // Sorted because an import appends older sessions after newer ones
  return parseSessionsCSV(content).sort(byTimestamp)
}

function formatSessionLine(session: Session): string {
  return [
    formatTimestamp(session.timestamp),
    escapeCSV(session.focusText),
    session.predictedSeconds.toString(),
    session.actualSeconds.toString(),
    session.status,
    session.tags.join(';'),
  ].join(',')
}

async function appendLines(lines: string[]): Promise<void> {
  if (lines.length === 0) return
  const csvPath = await getCSVPath()
  const body = lines.map(line => line + '\n').join('')
  if (!(await exists(csvPath))) {
    await writeTextFile(csvPath, SESSIONS_CSV_HEADER + body)
  } else {
    await writeTextFile(csvPath, body, { append: true })
  }
}

export async function appendSession(session: Session): Promise<void> {
  await appendLines([formatSessionLine(session)])
}

export async function importSessionsCSV(csv: string): Promise<{ added: number; skipped: number }> {
  const { added, skipped } = sessionsToImport(csv, await loadSessions())
  await appendLines(added.map(formatSessionLine))
  return { added: added.length, skipped }
}

export async function exportSessionsCSV(): Promise<string> {
  const csvPath = await getCSVPath()
  try {
    return await readTextFile(csvPath)
  } catch (err) {
    console.error('Failed to read CSV for export (returning header only):', err)
    return SESSIONS_CSV_HEADER
  }
}
