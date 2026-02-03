
import { useApp } from '../context/AppContext'
import { MiniTimer } from './MiniTimer'


export function Navbar() {
  const { screen, displayMode, setScreen } = useApp()

  // Hide navbar in small or zen display mode
  if (displayMode !== 'normal') {
    return null
  }

  // Show mini timer when not on the timer screen
  const showMiniTimer = screen !== 'timer'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-surface-raised/50 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <NavButton
          onClick={() => setScreen('timer')}
        >
          Timer
        </NavButton>
        <NavButton
          onClick={() => setScreen('stats')}
        >
          Stats
        </NavButton>
        <NavButton
          onClick={() => setScreen('settings')}
        >
          Settings
        </NavButton>
      </div>

      {showMiniTimer && <MiniTimer />}
    </nav>
  )
}

function NavButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-lg font-medium transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
    >
      {children}
    </button>
  )
}
