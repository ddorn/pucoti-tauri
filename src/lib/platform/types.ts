import type { Session } from '../session'
import type { Settings } from '../settings-types'

export interface Platform {
  isTauri: boolean

  // Storage
  loadSessions(): Promise<Session[]>
  appendSession(session: Session): Promise<void>
  exportSessionsCSV(): Promise<string>
  importSessionsCSV(csv: string): Promise<void>

  // Settings persistence
  loadSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  // Sound & notifications
  playBell(customBellPath?: string): void
  showNotification(title: string, body: string, customCommand?: string): Promise<void>

  // Window
  setSmallMode(settings: Settings): Promise<void>
  setNormalMode(settings: Settings): Promise<void>
  initializeWindowForPlatform(): Promise<void>
  onCloseRequested(handler: () => Promise<void>): Promise<() => void>

  // Shell / desktop capabilities
  openUrl(url: string): Promise<void>
  openFileDialog(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null>
  executeShellTemplate(command: string, placeholders: Record<string, string | number>, label: string): Promise<boolean>
  executePrefillHook(command: string): Promise<string | null>
  executeCompletionHook(focus: string, predicted: number, actual: number, command: string): Promise<boolean>
  executeCustomNotification(title: string, body: string, command: string): Promise<boolean>
}
