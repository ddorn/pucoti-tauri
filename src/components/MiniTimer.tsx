import { useApp } from '../context/AppContext'
import { useTimerState } from '../hooks/useTimerState'
import { CountdownDisplay } from './CountdownDisplay';
import clsx from 'clsx'

/**
 * Compact timer display for showing in navbar when on other screens.
 * Clicking navigates to the full timer screen.
 */
export function MiniTimer() {
  const { setScreen } = useApp()
  const { timerState, remaining, isOvertime } = useTimerState()

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
      <span className="text-accent font-medium truncate max-w-[120px]">
        {timerState.focusText}
      </span>
      <CountdownDisplay
        remaining={remaining}
      />
    </button>
  )
}
