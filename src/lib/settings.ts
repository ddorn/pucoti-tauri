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
  randomColorOnCompletion: boolean; // Randomly change accent color on timer completion

  // Last used values
  lastUsedDuration: number; // in seconds
  lastUsedTimerType: 'predict' | 'timebox' | 'ai-ab';

  // Timer start percentage
  timerStartPercentage: number; // Percentage of prediction where timer starts (0-100, default 100)

  // Completion hook
  completionCommand: string; // Shell command to run on timer completion with {focus}, {predicted}, {actual} placeholders

  // Prefill hook
  prefillCommand: string; // Shell command to run to prefill CommandPalette (output becomes input text)

  // GNOME panel indicator (Linux only)
  useGnomePanelIndicator: boolean;

  // Update checking
  checkForUpdatesAutomatically: boolean;
  dismissedUpdateVersion: string; // Version string that was dismissed in banner
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
  randomColorOnCompletion: false,
  lastUsedDuration: 20 * 60, // 20 minutes
  lastUsedTimerType: 'predict',
  timerStartPercentage: 100,
  completionCommand: '',
  prefillCommand: '',
  useGnomePanelIndicator: false,
  checkForUpdatesAutomatically: true,
  dismissedUpdateVersion: '',
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

    // Migration: rename lastUsedMode → lastUsedTimerType (if old key exists)
    if ('lastUsedMode' in saved && !('lastUsedTimerType' in saved)) {
      saved.lastUsedTimerType = saved.lastUsedMode
      delete saved.lastUsedMode
    }

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
 * Execute a shell command template with placeholder substitution.
 * String values are shell-escaped and quoted, numbers are substituted raw.
 */
async function executeShellTemplate(
  command: string,
  placeholders: Record<string, string | number>,
  label: string,
): Promise<boolean> {
  if (!command.trim()) {
    return false
  }

  let substituted = command
  for (const [key, value] of Object.entries(placeholders)) {
    const replacement = typeof value === 'string'
      ? `'${value.replace(/'/g, "'\\''")}'`
      : String(value)
    substituted = substituted.replaceAll(`{${key}}`, replacement)
  }

  try {
    const cmd = Command.create('run-sh', ['-c', substituted.trim()])
    const result = await cmd.execute()
    console.log(`[${label}] executed command: ${substituted}`)
    if (result.stdout) console.info(`[${label}] stdout: ${result.stdout}`)
    if (result.stderr) console.error(`[${label}] stderr: ${result.stderr}`)
    if (result.code !== 0) console.error(`[${label}] exited with code ${result.code}`)
    return true
  } catch (err) {
    console.error(`[${label}] command failed: ${err}`)
    return false
  }
}

export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  return executeShellTemplate(command, { title, body }, 'notification')
}

export async function executeCompletionHook(focus: string, predicted: number, actual: number, command: string): Promise<boolean> {
  return executeShellTemplate(command, { focus, predicted, actual }, 'completion-hook')
}

export async function executePrefillHook(command: string): Promise<string | null> {
  if (!command.trim()) return null
  try {
    const cmd = Command.create('run-sh', ['-c', command.trim()])
    const result = await cmd.execute()
    if (result.code !== 0) {
      console.error(`[prefill-hook] exited with code ${result.code}`)
      if (result.stdout) console.error(`[prefill-hook] stdout: ${result.stdout}`)
      if (result.stderr) console.error(`[prefill-hook] stderr: ${result.stderr}`)
      return null
    }
    return result.stdout.trim() || null
  } catch (err) {
    console.error(`[prefill-hook] command failed:`, err)
    return null
  }
}
