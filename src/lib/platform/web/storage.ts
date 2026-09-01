import { openDB, type IDBPDatabase } from 'idb'
import type { Session, SessionStatus } from '../../session'
import { escapeCSV, parseCSVLine } from '../csv'

const DB_NAME = 'pucoti'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { autoIncrement: true })
      }
    },
  })
}

function serializeSession(session: Session): object {
  return {
    timestamp: session.timestamp.toISOString(),
    focusText: session.focusText,
    predictedSeconds: session.predictedSeconds,
    actualSeconds: session.actualSeconds,
    status: session.status,
    tags: session.tags,
  }
}

function deserializeSession(raw: Record<string, unknown>): Session {
  return {
    timestamp: new Date(raw.timestamp as string),
    focusText: raw.focusText as string,
    predictedSeconds: raw.predictedSeconds as number,
    actualSeconds: raw.actualSeconds as number,
    status: raw.status as SessionStatus,
    tags: (raw.tags as string[]) ?? [],
  }
}

export async function loadSessions(): Promise<Session[]> {
  try {
    const db = await getDb()
    const raw = await db.getAll(SESSIONS_STORE)
    return raw.map(deserializeSession)
  } catch (err) {
    console.error('Failed to load sessions from IndexedDB:', err)
    return []
  }
}

export async function appendSession(session: Session): Promise<void> {
  try {
    const db = await getDb()
    await db.add(SESSIONS_STORE, serializeSession(session))
  } catch (err) {
    console.error('Failed to append session to IndexedDB:', err)
    throw err
  }
}

export async function exportSessionsCSV(): Promise<string> {
  const sessions = await loadSessions()
  const header = 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'
  const rows = sessions
    .map(s =>
      [
        s.timestamp.toISOString(),
        escapeCSV(s.focusText),
        s.predictedSeconds.toString(),
        s.actualSeconds.toString(),
        s.status,
        s.tags.join(';'),
      ].join(',')
    )
    .join('\n')
  return rows ? header + rows + '\n' : header
}

export async function importSessionsCSV(csv: string): Promise<void> {
  const lines = csv.trim().split('\n')
  if (lines.length <= 1) return

  const db = await getDb()
  const tx = db.transaction(SESSIONS_STORE, 'readwrite')
  const store = tx.objectStore(SESSIONS_STORE)

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    if (fields.length < 5) continue

    const [timestamp, focusText, predictedSeconds, actualSeconds, status, tags = ''] = fields
    const session: Session = {
      timestamp: new Date(timestamp),
      focusText,
      predictedSeconds: parseInt(predictedSeconds, 10),
      actualSeconds: parseInt(actualSeconds, 10),
      status: status as SessionStatus,
      tags: tags ? tags.split(';').map(t => t.trim()) : [],
    }
    await store.add(serializeSession(session))
  }

  await tx.done
}
