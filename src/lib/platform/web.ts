/**
 * Web platform implementation.
 * Uses browser APIs: IndexedDB (via idb), localStorage, Web Notifications, Web Audio.
 */
import type { Platform } from './types'
import type { Session, SessionStatus } from '../session'
import { DEFAULT_SETTINGS, type Settings } from '../settings-types'
import { openDB, type IDBPDatabase } from 'idb'

// ---------------------------------------------------------------------------
// IndexedDB setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function loadSessions(): Promise<Session[]> {
  try {
    const db = await getDb()
    const raw = await db.getAll(SESSIONS_STORE)
    return raw.map(deserializeSession)
  } catch (err) {
    console.error('Failed to load sessions from IndexedDB:', err)
    return []
  }
}

async function appendSession(session: Session): Promise<void> {
  try {
    const db = await getDb()
    await db.add(SESSIONS_STORE, serializeSession(session))
  } catch (err) {
    console.error('Failed to append session to IndexedDB:', err)
    throw err
  }
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

function formatTimestamp(date: Date): string {
  return date.toISOString()
}

async function exportSessionsCSV(): Promise<string> {
  const sessions = await loadSessions()
  const header = 'timestamp,focus_text,predicted_seconds,actual_seconds,status,tags\n'
  const rows = sessions
    .map(s =>
      [
        formatTimestamp(s.timestamp),
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

async function importSessionsCSV(csv: string): Promise<void> {
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

// ---------------------------------------------------------------------------
// Settings (localStorage)
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'pucoti_settings'

async function loadSettings(): Promise<Settings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }

    const saved = JSON.parse(raw)

    // Migration: rename lastUsedMode → lastUsedTimerType
    if ('lastUsedMode' in saved && !('lastUsedTimerType' in saved)) {
      saved.lastUsedTimerType = saved.lastUsedMode
      delete saved.lastUsedMode
    }

    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

function playBell(_customBellPath?: string): void {
  // Ignore customBellPath on web — always use bundled bell
  const audio = new Audio('/bell.mp3')
  audio.play().catch(err => {
    console.error('Bell play failed:', err)
  })
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function showNotification(
  title: string,
  body: string,
  _customCommand?: string // ignored on web
): Promise<void> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body })
    return
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, { body })
    }
  }
}

// ---------------------------------------------------------------------------
// Window management (no-ops on web)
// ---------------------------------------------------------------------------

async function noopAsync(): Promise<void> {
  // no-op
}

// ---------------------------------------------------------------------------
// Web platform object
// ---------------------------------------------------------------------------

export const webPlatform: Platform = {
  isTauri: false,

  loadSessions,
  appendSession,
  exportSessionsCSV,
  importSessionsCSV,

  loadSettings,
  saveSettings,

  playBell,
  showNotification,

  setSmallMode: async (_settings: Settings) => {},
  setNormalMode: async (_settings: Settings) => {},
  initializeWindowForPlatform: noopAsync,

  async onCloseRequested(_handler: () => Promise<void>): Promise<() => void> {
    // No-op on web — user decided not to save on close for the web version
    return () => { /* cleanup no-op */ }
  },

  async openUrl(url: string): Promise<void> {
    window.open(url, '_blank')
  },

  async openFileDialog(_filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
    // No native file dialog on web
    return null
  },

  async executeShellTemplate(_command: string, _placeholders: Record<string, string | number>, _label: string): Promise<boolean> {
    return false
  },

  async executePrefillHook(_command: string): Promise<string | null> {
    return null
  },

  async executeCompletionHook(_focus: string, _predicted: number, _actual: number, _command: string): Promise<boolean> {
    return false
  },

  async executeCustomNotification(_title: string, _body: string, _command: string): Promise<boolean> {
    return false
  },
}
