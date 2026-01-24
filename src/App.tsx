import { AppProvider, useApp } from './context/AppContext'
import { NewFocus } from './screens/NewFocus'
import { Timer } from './screens/Timer'
import { History } from './screens/History'
import clsx from 'clsx'

function AppContent() {
  const { screen, timerMode, setScreen, timerState } = useApp()

  // Hide navbar in small or presentation modes
  const showNavbar = timerMode === 'normal'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {showNavbar && (
        <nav className="flex items-center justify-center gap-1 px-4 py-3 border-b border-zinc-800/50 bg-surface-raised/50 backdrop-blur-sm">
          <NavButton
            active={screen === 'new-focus'}
            onClick={() => setScreen('new-focus')}
            disabled={!!timerState} // Can't navigate away during timer
          >
            New Focus
          </NavButton>
          <NavButton
            active={screen === 'timer'}
            onClick={() => setScreen('timer')}
            disabled={!timerState} // Can't go to timer without active session
          >
            Timer
          </NavButton>
          <NavButton
            active={screen === 'history'}
            onClick={() => setScreen('history')}
            disabled={!!timerState} // Can't navigate away during timer
          >
            History
          </NavButton>
        </nav>
      )}

      <main className="flex-1">
        {screen === 'new-focus' && <NewFocus />}
        {screen === 'timer' && <Timer />}
        {screen === 'history' && <History />}
      </main>
    </div>
  )
}

function NavButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
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

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
