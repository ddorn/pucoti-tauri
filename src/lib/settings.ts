import { resolve } from '@tauri-apps/api/path';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell'
import { getDataDir } from './paths'
import type { Corner } from './window'

export interface Settings {
  // Notification
  notificationCommand: string // Custom command with {title} and {body} placeholders

  // Bell behavior
  bellRepeatIntervalSeconds: number; // How frequently the bell repeats during overtime (in seconds)
  customBellPath: string; // Path to custom bell sound file (empty = use default)

  // Window sizes
  normalWindowWidth: number
  normalWindowHeight: number
  smallWindowWidth: number
  smallWindowHeight: number

  // Small window behavior
  smallWindowBorderless: boolean

  // Timer start behavior
  onTimerStart: 'nothing' | 'corner' | 'minimize'

  // Corner margins
  cornerMarginTop: number
  cornerMarginRight: number
  cornerMarginBottom: number
  cornerMarginLeft: number

  // Small window corner position
  corner: Corner

  // AI Productivity Experiment
  enableAiProductivityExperiment: boolean;

  // Accent color
  accentColor: 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';

  // Last used values
  lastUsedDuration: number; // in seconds
  lastUsedMode: 'predict' | 'timebox' | 'ai-ab';

  // Default duration behavior
  defaultDurationMode: 'none' | 'last' | 'fixed'; // How to set default duration in NewFocus screen
  defaultDurationSeconds: number; // Fixed duration in seconds (used when defaultDurationMode is 'fixed')

  // Timer start percentage
  timerStartPercentage: number; // Percentage of prediction where timer starts (0-100, default 100)

  // GNOME panel indicator (Linux only)
  useGnomePanelIndicator: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  notificationCommand: '', // Empty = use default OS notification
  bellRepeatIntervalSeconds: 20,
  customBellPath: '', // Empty = use bundled default bell
  normalWindowWidth: 600,
  normalWindowHeight: 500,
  smallWindowWidth: 220,
  smallWindowHeight: 80,
  smallWindowBorderless: false,
  onTimerStart: 'nothing',
  cornerMarginTop: 16,
  cornerMarginRight: 16,
  cornerMarginBottom: 16,
  cornerMarginLeft: 16,
  corner: 'bottom-right',
  enableAiProductivityExperiment: false,
  accentColor: 'amber',
  lastUsedDuration: 20 * 60, // 20 minutes
  lastUsedMode: 'predict',
  defaultDurationMode: 'none', // No default duration
  defaultDurationSeconds: 25 * 60, // 25 minutes (used when defaultDurationMode is 'fixed')
  timerStartPercentage: 100,
  useGnomePanelIndicator: false,
}

async function getSettingsPath(): Promise<string> {
  const dir = await getDataDir()
  return await resolve(dir, 'settings.json')
}

export async function loadSettings(): Promise<Settings> {
  const path = await getSettingsPath()
  try {
    const content = await readTextFile(path)
    const saved = JSON.parse(content)
    // Merge with defaults to handle new settings added in updates
    return { ...DEFAULT_SETTINGS, ...saved }
  } catch (err) {
    console.error('Failed to load settings. Using default settings.', err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    const path = await getSettingsPath()
    await writeTextFile(path, JSON.stringify(settings, null, 2))
  } catch (err) {
    console.error('Failed to save settings:', err)
    throw err
  }
}

/**
 * Execute custom notification command with placeholder substitution.
 * Returns true if command was executed, false if no custom command configured.
 */
/**
 * Execute custom notification command with placeholder substitution.
 * Returns true if command was executed, false if no custom command configured.
 */
export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  if (!command.trim()) {
    return false
  }

  // Escape title and body for shell
  title = title.replace(/'/g, "'\\''")
  body = body.replace(/'/g, "'\\''")

  const substituted = command
    .replace(/\{title\}/g, `'${title}'`)
    .replace(/\{body\}/g, `'${body}'`)

  try {
    // Use scoped sh command with -c to execute arbitrary shell commands
    // This works because run-sh has args: true, allowing any arguments
    const cmd = Command.create('run-sh', ['-c', substituted.trim()])
    await cmd.execute()
    return true
  } catch (err) {
    console.error('Custom notification command failed:', err)
    return false
  }
}
