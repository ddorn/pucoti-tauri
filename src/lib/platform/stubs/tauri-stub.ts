/**
 * Stub for the Tauri platform implementation — used in web builds.
 * The `tauriPlatform` export here is never actually called (the web build
 * always uses `webPlatform`), but it satisfies the static import in
 * platform/index.ts so the web bundle compiles cleanly.
 */
import type { Platform } from '../types'
import { DEFAULT_SETTINGS } from '../../settings-types'

// Minimal stub satisfying the type; methods are never called in web builds.
export const tauriPlatform: Platform = {
  isTauri: false,
  loadSessions: async () => [],
  appendSession: async () => {},
  exportSessionsCSV: async () => '',
  importSessionsCSV: async () => {},
  loadSettings: async () => DEFAULT_SETTINGS,
  saveSettings: async () => {},
  playBell: () => {},
  showNotification: async () => {},
  setSmallMode: async () => {},
  setNormalMode: async () => {},
  initializeWindowForPlatform: async () => {},
  onCloseRequested: async () => () => {},
  openUrl: async () => {},
  openFileDialog: async () => null,
  executeShellTemplate: async () => false,
  executePrefillHook: async () => null,
  executeCompletionHook: async () => false,
  executeCustomNotification: async () => false,
}
