
import { useApp } from '../context/AppContext'
import { MiniTimer } from './MiniTimer'
import { UpdateBanner } from './UpdateBanner'

export function Navbar() {
  const { screen, displayMode, setScreen, updateInfo } = useApp()

  // Hide navbar in small or zen display mode
  if (displayMode !== 'normal') {
    return null
  }

  // Show mini timer when not on the timer screen
  const showMiniTimer = screen !== 'timer'

  // Calculate navbar height for spacer
  // UpdateBanner adds ~42px when visible, nav is ~49px
  const navbarHeight = updateInfo ? '91px' : '49px'

  return (
    <>
      {/* Spacer to prevent content from being hidden under fixed navbar */}
      <div style={{ height: navbarHeight }} />

      {/* Fixed navbar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <UpdateBanner />
        <nav className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-surface-raised/50 backdrop-blur-sm">
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
      </div>
    </>
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
