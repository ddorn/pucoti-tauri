import Neutralino from '@neutralinojs/lib'
import { formatTimestamp } from './format'

export type SessionStatus = 'completed' | 'canceled' | 'unknown'

export interface Session {
  timestamp: Date
  focusText: string
  predictedSeconds: number
  actualSeconds: number
  status: SessionStatus
  tags: string[]
}

export interface ActiveSession {
  startTime: string
  focusText: string
  predictedSeconds: number
}

let dataDir: string | null = null

async function getDataDir(): Promise<string> {
  if (dataDir) return dataDir
  const base = await Neutralino.os.getPath('data')
  if ((await Neutralino.computer.getKernelInfo()).variant === 'Windows NT') {
    dataDir = `${base}\\pucoti`
  } else {
    dataDir = `${base}/pucoti`
  }

  try {
    let stats = await Neutralino.filesystem.getStats(dataDir)
    if (!stats.isDirectory) {
      throw new Error('Data directory is not a directory')
    }
  } catch {
    await Neutralino.filesystem.createDirectory(dataDir)
  }
  return dataDir
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
  return `${dir}/sessions.csv`
}

export async function getActiveSessionPath(): Promise<string> {
  const dir = await getDataDir()
  return `${dir}/pucoti_active_session.json`
}

export async function loadSessions(): Promise<Session[]> {
  const csvPath = await getCSVPath()
  let content: string
  try {
    content = await Neutralino.filesystem.readFile(csvPath)
  } catch {
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
  let fileExists = true
  try {
    await Neutralino.filesystem.readFile(csvPath)
  } catch {
    fileExists = false
  }

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
    await Neutralino.filesystem.writeFile(csvPath, header + line + '\n')
  } else {
    await Neutralino.filesystem.appendFile(csvPath, line + '\n')
  }
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  const path = await getActiveSessionPath()
  await Neutralino.filesystem.writeFile(path, JSON.stringify(session))
}

export async function loadActiveSession(): Promise<ActiveSession | null> {
  const path = await getActiveSessionPath()
  try {
    const content = await Neutralino.filesystem.readFile(path)
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function clearActiveSession(): Promise<void> {
  const path = await getActiveSessionPath()
  try {
    await Neutralino.filesystem.remove(path)
  } catch {
    // File might not exist, that's fine
  }
}

/**
 * Check for orphaned active session on app launch.
 * If found, mark it as 'unknown' status and append to CSV.
 */
export async function recoverOrphanedSession(): Promise<void> {
  const activeSession = await loadActiveSession()
  if (!activeSession) return

  // Calculate how long the session was active before app quit
  const startTime = new Date(activeSession.startTime)
  const now = new Date()
  const actualSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)

  await appendSession({
    timestamp: startTime,
    focusText: activeSession.focusText,
    predictedSeconds: activeSession.predictedSeconds,
    actualSeconds,
    status: 'unknown',
    tags: [],
  })

  await clearActiveSession()
}

export async function exportSessionsCSV(): Promise<string> {
  const csvPath = await getCSVPath()
  try {
    return await Neutralino.filesystem.readFile(csvPath)
  } catch {
    return 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'
  }
}
