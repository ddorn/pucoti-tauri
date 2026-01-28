import { useCallback, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { NewFocus } from './screens/NewFocus'
import { Timer } from './screens/Timer'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'
import { MiniTimer } from './components/MiniTimer'
import { setNormalMode, setSmallMode, initializeWindowForPlatform } from './lib/window';
import { applyAccentColor } from './lib/colors';
import { getCurrentWindow } from '@tauri-apps/api/window';
import clsx from 'clsx'

function AppContent() {
  const { screen, timerMode, setScreen, timerState } = useApp()

  // Hide navbar only when there's an active timer in small or zen mode
  const showNavbar = !timerState || timerMode === 'normal'

  // Show mini timer when there's an active timer but we're not on the timer screen
  const showMiniTimer = timerState && screen !== 'timer'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {showNavbar && (
        <nav className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-surface-raised/50 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <NavButton
              active={screen === 'new-focus'}
              onClick={() => setScreen('new-focus')}
            >
              New Focus
            </NavButton>
            <NavButton
              active={screen === 'timer'}
              onClick={() => setScreen('timer')}
              disabled={!timerState}
            >
              Timer
            </NavButton>
            <NavButton
              active={screen === 'stats'}
              onClick={() => setScreen('stats')}
            >
              Stats
            </NavButton>
            <NavButton
              active={screen === 'settings'}
              onClick={() => setScreen('settings')}
            >
              Settings
            </NavButton>
          </div>

          {showMiniTimer && (
            <MiniTimer />
          )}
        </nav>
      )}

      <main className="flex-1 min-h-0 flex flex-col">
        {screen === 'new-focus' && <NewFocus />}
        {screen === 'timer' && <Timer />}
        {screen === 'stats' && <Stats />}
        {screen === 'settings' && <Settings />}
      </main>
    </div>
  )
}

function NavButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-accent/20 text-accent'
          : disabled
          ? 'text-zinc-600 cursor-not-allowed'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Bridge component that connects SettingsContext to AppProvider
 */
function AppWithSettings({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()

  // Initialize window decorations for platform (e.g., disable on Sway)
  useEffect(() => {
    initializeWindowForPlatform();
  }, [])

  // Apply accent color when settings change
  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor])

  const handleTimerStart = useCallback(async () => {
    // Switch to small mode with current settings
    await setSmallMode(settings)
  }, [settings])

  const handleTimerComplete = useCallback(async () => {
    // Reset window to normal mode with current settings
    await setNormalMode(settings)
  }, [settings])

  const handleTimerCancel = useCallback(async () => {
    // Reset window to normal mode with current settings
    await setNormalMode(settings)
  }, [settings])

  return (
    <AppProvider
      onTimerStart={handleTimerStart}
      onTimerComplete={handleTimerComplete}
      onTimerCancel={handleTimerCancel}
    >
      {children}
    </AppProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AppWithSettings>
        <AppContent />
      </AppWithSettings>
    </SettingsProvider>
  )
}
