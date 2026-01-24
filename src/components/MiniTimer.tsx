import { useApp } from '../context/AppContext'
import { formatCountdown } from '../lib/format'
import clsx from 'clsx'

/**
 * Compact timer display for showing in navbar when on other screens.
 * Clicking navigates to the full timer screen.
 */
export function MiniTimer() {
  const { timerState, remaining, isOvertime, setScreen } = useApp()

  if (!timerState) return null

  return (
    <button
      onClick={() => setScreen('timer')}
      className={clsx(
        'flex items-center gap-2 px-3 py-1 rounded-lg transition-colors',
        'hover:bg-zinc-800/50',
        isOvertime ? 'bg-red-500/10' : 'bg-zinc-800/30'
      )}
      title="Go to timer"
    >
      <span className="text-amber-400 text-sm font-medium truncate max-w-[120px]">
        {timerState.focusText}
      </span>
      <span
        className={clsx(
          'font-timer text-sm font-bold',
          isOvertime ? 'text-red-500' : 'text-zinc-100'
        )}
      >
        {formatCountdown(remaining)}
      </span>
    </button>
  )
}
