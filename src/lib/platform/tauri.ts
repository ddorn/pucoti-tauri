/**
 * Tauri platform implementation.
 * Re-exports from existing Tauri-specific modules and wraps them to match
 * the Platform interface.
 */
import type { Platform } from './types'
import type { Session } from '../session'
import {
  loadSessions as tauriLoadSessions,
  appendSession as tauriAppendSession,
  exportSessionsCSV as tauriExportSessionsCSV,
} from '../storage'
import {
  loadSettings as tauriLoadSettings,
  saveSettings as tauriSaveSettings,
  executeShellTemplate as tauriExecuteShellTemplate,
  executeCustomNotification as tauriExecuteCustomNotification,
  executeCompletionHook as tauriExecuteCompletionHook,
  executePrefillHook as tauriExecutePrefillHook,
} from '../settings'
import { playBell as tauriPlayBell, showNotification as tauriShowNotification } from '../sound'
import { setSmallMode as tauriSetSmallMode, setNormalMode as tauriSetNormalMode, initializeWindowForPlatform as tauriInitializeWindowForPlatform } from '../window'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open as tauriOpenUrl } from '@tauri-apps/plugin-shell'
import { open as tauriOpenDialog } from '@tauri-apps/plugin-dialog'

/**
 * Parse CSV text and append each session to the Tauri CSV file.
 */
async function importSessionsCSV(csv: string): Promise<void> {
  const lines = csv.trim().split('\n')
  if (lines.length <= 1) return // Only header or empty

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    if (fields.length < 5) continue

    const [timestamp, focusText, predictedSeconds, actualSeconds, status, tags = ''] = fields
    await tauriAppendSession({
      timestamp: new Date(timestamp),
      focusText,
      predictedSeconds: parseInt(predictedSeconds, 10),
      actualSeconds: parseInt(actualSeconds, 10),
      status: status as Session['status'],
      tags: tags ? tags.split(';').map(t => t.trim()) : [],
    })
  }
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

export const tauriPlatform: Platform = {
  isTauri: true,

  loadSessions: tauriLoadSessions,
  appendSession: tauriAppendSession,
  exportSessionsCSV: tauriExportSessionsCSV,
  importSessionsCSV,

  loadSettings: tauriLoadSettings,
  saveSettings: tauriSaveSettings,

  playBell: tauriPlayBell,
  showNotification: tauriShowNotification,

  setSmallMode: tauriSetSmallMode,
  setNormalMode: tauriSetNormalMode,
  initializeWindowForPlatform: tauriInitializeWindowForPlatform,

  async onCloseRequested(handler: () => Promise<void>): Promise<() => void> {
    const win = getCurrentWindow()
    const unlisten = await win.onCloseRequested(async () => {
      await handler()
    })
    return unlisten
  },

  async openUrl(url: string): Promise<void> {
    await tauriOpenUrl(url)
  },

  async openFileDialog(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
    const result = await tauriOpenDialog({ multiple: false, filters })
    if (result && typeof result === 'string') return result
    return null
  },

  executeShellTemplate: tauriExecuteShellTemplate,
  executePrefillHook: tauriExecutePrefillHook,
  executeCompletionHook: tauriExecuteCompletionHook,
  executeCustomNotification: tauriExecuteCustomNotification,
}
