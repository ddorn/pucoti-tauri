import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { Timer } from './screens/Timer'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'
import { Completion } from './screens/Completion'
import { MiniTimer } from './components/MiniTimer'
import { initializeWindowForPlatform } from './lib/window';
import { applyAccentColor } from './lib/colors';
import clsx from 'clsx'

function AppContent() {
  const { screen, displayMode, setScreen } = useApp()

  // Hide navbar in small or zen display mode
  const showNavbar = displayMode === 'normal'

  // Show mini timer when not on the timer screen
  const showMiniTimer = screen !== 'timer'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {showNavbar && (
        <nav className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-surface-raised/50 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <NavButton
              active={screen === 'timer'}
              onClick={() => setScreen('timer')}
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
        {screen === 'timer' && <Timer />}
        {screen === 'stats' && <Stats />}
        {screen === 'settings' && <Settings />}
        {screen === 'completion' && <Completion />}
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

  return (
    <AppProvider>
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
