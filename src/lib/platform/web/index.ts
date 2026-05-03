/**
 * Web platform implementation. Assembles the capability modules in this
 * folder into a single Platform object.
 */
import type { Platform } from '../types'
import { loadSessions, appendSession, exportSessionsCSV, importSessionsCSV } from './storage'
import { loadSettings, saveSettings } from './settings'
import { playBell, showNotification } from './notifications'

export const webPlatform: Platform = {
  loadSessions,
  appendSession,
  exportSessionsCSV,
  importSessionsCSV,
  getSessionsStoragePath: async () => null,

  loadSettings,
  saveSettings,

  playBell,
  showNotification,

  setSmallMode: async () => {},
  setNormalMode: async () => {},
  initializeWindowForPlatform: async () => {},

  async onCloseRequested() {
    return () => {}
  },

  async openUrl(url) {
    window.open(url, '_blank')
  },

  async openFileDialog() {
    return null
  },

  async runShell() {
    return null
  },

  gnome: {
    detect: async () => false,
    getStatus: async () => 'not-gnome',
    enable: async () => false,
    disable: async () => false,
    updatePanel: () => {},
  },
}
