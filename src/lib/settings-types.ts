import type { Corner } from './corner'

export interface Settings {
  // Notification
  notificationCommand: string

  // Bell behavior
  bellRepeatIntervalSeconds: number
  customBellPath: string

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
  enableAiProductivityExperiment: boolean

  // Accent color
  accentColor: 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose'
  randomColorOnCompletion: boolean

  // Last used values
  lastUsedDuration: number
  lastUsedTimerType: 'predict' | 'timebox' | 'ai-ab'

  // Timer start percentage
  timerStartPercentage: number

  // Completion hook
  completionCommand: string

  // Prefill hook
  prefillCommand: string

  // GNOME panel indicator (Linux only)
  useGnomePanelIndicator: boolean

  // Update checking
  checkForUpdatesAutomatically: boolean
  dismissedUpdateVersion: string

  // Calibration training
  scrambleTimer: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  notificationCommand: '',
  bellRepeatIntervalSeconds: 20,
  customBellPath: '',
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
  lastUsedDuration: 20 * 60,
  lastUsedTimerType: 'predict',
  timerStartPercentage: 100,
  completionCommand: '',
  prefillCommand: '',
  useGnomePanelIndicator: false,
  checkForUpdatesAutomatically: true,
  dismissedUpdateVersion: '',
  scrambleTimer: false,
}
