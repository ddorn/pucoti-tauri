import type { Session } from '../session'
import type { Settings } from '../settings-types'

export interface Platform {
  // Storage
  loadSessions(): Promise<Session[]>
  appendSession(session: Session): Promise<void>
  exportSessionsCSV(): Promise<string>
  importSessionsCSV(csv: string): Promise<void>
  /** Filesystem path of the sessions CSV (shown in UI). Null on platforms without disk storage. */
  getSessionsStoragePath(): Promise<string | null>

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
  /** Execute a shell command. Returns null if the platform doesn't support shell exec (e.g. web). */
  runShell(command: string): Promise<ShellResult | null>

  // GNOME extension (no-op on non-supporting platforms)
  gnome: GnomePlatform
}

export interface ShellResult {
  code: number
  stdout: string
  stderr: string
}

export type GnomeExtensionStatus =
  | 'enabled'
  | 'disabled'
  | 'not-loaded'
  | 'not-installed'
  | 'not-gnome'

export interface GnomePanelState {
  running: boolean
  remainingSeconds: number
  focusText: string
  isOvertime: boolean
}

export interface GnomePlatform {
  detect(): Promise<boolean>
  getStatus(): Promise<GnomeExtensionStatus>
  enable(): Promise<boolean>
  disable(): Promise<boolean>
  updatePanel(state: GnomePanelState): void
}
