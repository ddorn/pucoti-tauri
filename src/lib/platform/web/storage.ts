import { openDB, type IDBPDatabase } from 'idb'
import type { Session, SessionStatus } from '../../session'
import { escapeCSV, sessionsToImport, byTimestamp, SESSIONS_CSV_HEADER } from '../csv'

const DB_NAME = 'pucoti'
const DB_VERSION = 1
const SESSIONS_STORE = 'sessions'

/**
 * Sessions waiting to reach IndexedDB. A session saved as the tab closes would
 * otherwise be lost: IndexedDB is asynchronous and the page does not wait for it, but a
 * localStorage write is done the moment it returns. Whatever is left here is moved over
 * on the next visit.
 */
const OUTBOX_KEY = 'pucoti_session_outbox'

type StoredSession = ReturnType<typeof serializeSession>

/**
 * Each queued session carries the key it will have in IndexedDB, so moving it there is
 * a `put` that can safely run twice - as it does if the tab closes after the write
 * landed but before the outbox was cleared.
 */
interface OutboxEntry {
  key: string
  row: StoredSession
}

function newOutboxKey(): string {
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `outbox:${id}`
}

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { autoIncrement: true })
      }
    },
  })
}

function serializeSession(session: Session) {
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

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeOutbox(rows: OutboxEntry[]) {
  if (rows.length === 0) localStorage.removeItem(OUTBOX_KEY)
  else localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows))
}

/**
 * Move the outbox into IndexedDB. Serialised within the tab, and across tabs where the
 * browser has Web Locks, so that one flush never clears rows another is still writing.
 */
let flushChain: Promise<void> = Promise.resolve()

function flushOutbox(): Promise<void> {
  const flush = async () => {
    const rows = readOutbox()
    if (rows.length === 0) return
    const db = await getDb()
    const tx = db.transaction(SESSIONS_STORE, 'readwrite')
    for (const { key, row } of rows) tx.store.put(row, key)
    await tx.done
    // Sessions are only ever added at the end, so anything queued meanwhile is kept
    writeOutbox(readOutbox().slice(rows.length))
  }
  const locked = async () => {
    if (navigator.locks) await navigator.locks.request(OUTBOX_KEY, flush)
    else await flush()
  }
  flushChain = flushChain.catch(() => {}).then(locked)
  return flushChain
}

export async function loadSessions(): Promise<Session[]> {
  try {
    await flushOutbox()
  } catch (err) {
    console.error('Failed to move queued sessions to IndexedDB:', err)
  }
  try {
    const db = await getDb()
    const raw = await db.getAll(SESSIONS_STORE)
    // Sorted because an import adds older sessions after newer ones
    return raw.map(deserializeSession).sort(byTimestamp)
  } catch (err) {
    console.error('Failed to load sessions from IndexedDB:', err)
    return []
  }
}

/**
 * Not an async function on purpose: the session is in the outbox by the time this
 * returns, before anything is awaited. See OUTBOX_KEY.
 */
export function appendSession(session: Session): Promise<void> {
  const row = serializeSession(session)
  try {
    writeOutbox([...readOutbox(), { key: newOutboxKey(), row }])
  } catch (err) {
    // localStorage can be unavailable or full; IndexedDB may still work
    console.error('Failed to queue session, writing it directly:', err)
    return getDb().then(db => db.add(SESSIONS_STORE, row)).then(() => {})
  }
  return flushOutbox().catch(err => {
    console.error('Failed to append session to IndexedDB (kept for the next visit):', err)
    throw err
  })
}

export async function exportSessionsCSV(): Promise<string> {
  const sessions = await loadSessions()
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
  return rows ? SESSIONS_CSV_HEADER + rows + '\n' : SESSIONS_CSV_HEADER
}

export async function importSessionsCSV(csv: string): Promise<{ added: number; skipped: number }> {
  const { added, skipped } = sessionsToImport(csv, await loadSessions())
  if (added.length > 0) {
    const db = await getDb()
    const tx = db.transaction(SESSIONS_STORE, 'readwrite')
    for (const session of added) tx.store.add(serializeSession(session))
    await tx.done
  }
  return { added: added.length, skipped }
}
