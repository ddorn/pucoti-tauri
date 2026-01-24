import { AppProvider, useApp } from './context/AppContext'
import { NewFocus } from './screens/NewFocus'
import { Timer } from './screens/Timer'
import { History } from './screens/History'
import { MiniTimer } from './components/MiniTimer'
import clsx from 'clsx'

function AppContent() {
  const { screen, timerMode, setScreen, timerState } = useApp()

  // Hide navbar in small or presentation modes
  const showNavbar = timerMode === 'normal'

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
              active={screen === 'history'}
              onClick={() => setScreen('history')}
            >
              History
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

      <main className="flex-1">
        {screen === 'new-focus' && <NewFocus />}
        {screen === 'timer' && <Timer />}
        {screen === 'history' && <History />}
        {screen === 'settings' && <SettingsPlaceholder />}
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

// Temporary placeholder until Settings screen is implemented
function SettingsPlaceholder() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-zinc-500">Settings coming soon...</p>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
