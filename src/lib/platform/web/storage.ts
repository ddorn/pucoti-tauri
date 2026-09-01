import { openDB, type IDBPDatabase } from 'idb'
import type { Session, SessionStatus } from '../../session'
import { CSV_HEADER, parseCSVLine, parseSessionFields, serializeSessionRow } from '../csv'

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
    focusSeconds: session.focusSeconds,
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
    // Rows stored before stacked timers have no focusSeconds: nothing could be held.
    focusSeconds: (raw.focusSeconds as number) ?? (raw.actualSeconds as number),
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
  const rows = sessions
    .map(s => serializeSessionRow({ ...s, timestamp: s.timestamp.toISOString() }))
    .join('\n')
  return rows ? CSV_HEADER + '\n' + rows + '\n' : CSV_HEADER + '\n'
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

    const fields = parseSessionFields(parseCSVLine(line))
    if (!fields) continue

    const session: Session = {
      ...fields,
      timestamp: new Date(fields.timestamp),
      status: fields.status as SessionStatus,
    }
    await store.add(serializeSession(session))
  }

  await tx.done
}
