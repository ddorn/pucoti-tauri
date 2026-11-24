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
  getMaxWindowSize: async () => null,

  async onCloseRequested(handler) {
    // pagehide rather than beforeunload: it also fires on mobile, where tabs are
    // mostly closed from the switcher. A persisted page went into the back/forward
    // cache and may well come back with its timer still running, so it is not saved
    // as gone.
    const listener = (e: PageTransitionEvent) => {
      if (!e.persisted) void handler()
    }
    window.addEventListener('pagehide', listener)
    return () => window.removeEventListener('pagehide', listener)
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
