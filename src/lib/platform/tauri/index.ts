/**
 * Tauri platform implementation. Assembles the capability modules in this
 * folder into a single Platform object.
 */
import type { Platform, ShellResult } from '../types'
import type { Session } from '../../session'
import { loadSessions, appendSession, exportSessionsCSV, getCSVPath } from './storage'
import { loadSettings, saveSettings } from './settings'
import { playBell, showNotification } from './sound'
import { setSmallMode, setNormalMode, initializeWindowForPlatform } from './window'
import {
  detectGnome,
  getExtensionStatus,
  enableExtension,
  disableExtension,
} from './gnome-extension'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { Command, open as tauriOpenUrl } from '@tauri-apps/plugin-shell'
import { open as tauriOpenDialog } from '@tauri-apps/plugin-dialog'
import { parseCSVLine } from '../csv'

async function importSessionsCSV(csv: string): Promise<void> {
  const lines = csv.trim().split('\n')
  if (lines.length <= 1) return

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    if (fields.length < 5) continue

    const [timestamp, focusText, predictedSeconds, actualSeconds, status, tags = ''] = fields
    await appendSession({
      timestamp: new Date(timestamp),
      focusText,
      predictedSeconds: parseInt(predictedSeconds, 10),
      actualSeconds: parseInt(actualSeconds, 10),
      status: status as Session['status'],
      tags: tags ? tags.split(';').map(t => t.trim()) : [],
    })
  }
}

export const tauriPlatform: Platform = {
  loadSessions,
  appendSession,
  exportSessionsCSV,
  importSessionsCSV,
  getSessionsStoragePath: getCSVPath,

  loadSettings,
  saveSettings,

  playBell,
  showNotification,

  setSmallMode,
  setNormalMode,
  initializeWindowForPlatform,

  async onCloseRequested(handler) {
    const win = getCurrentWindow()
    return await win.onCloseRequested(async () => {
      await handler()
    })
  },

  async openUrl(url) {
    await tauriOpenUrl(url)
  },

  async openFileDialog(filters) {
    const result = await tauriOpenDialog({ multiple: false, filters })
    return typeof result === 'string' ? result : null
  },

  async runShell(command: string): Promise<ShellResult | null> {
    try {
      const cmd = Command.create('run-sh', ['-c', command])
      const result = await cmd.execute()
      return { code: result.code ?? 0, stdout: result.stdout, stderr: result.stderr }
    } catch (err) {
      console.error('runShell failed:', err)
      return null
    }
  },

  gnome: {
    detect: detectGnome,
    getStatus: getExtensionStatus,
    enable: enableExtension,
    disable: disableExtension,
    updatePanel(state) {
      invoke('update_timer_state', { ...state }).catch(() => {})
    },
  },
}
