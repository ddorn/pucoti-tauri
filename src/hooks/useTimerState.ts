import { useSyncExternalStore } from 'react'
import { timerMachine, type TimerState } from '../lib/timer-machine'

interface TimerStateResult {
  timerState: TimerState | null
  elapsed: number
  remaining: number
  isOvertime: boolean
}

// Cache the snapshot to avoid infinite loops with useSyncExternalStore
let cachedSnapshot: TimerStateResult = {
  timerState: null,
  elapsed: 0,
  remaining: 0,
  isOvertime: false,
}

function updateSnapshot() {
  const state = timerMachine.getState()
  const computed = timerMachine.getComputed()
  cachedSnapshot = {
    timerState: state,
    elapsed: computed?.elapsed ?? 0,
    remaining: computed?.remaining ?? 0,
    isOvertime: computed?.isOvertime ?? false,
  }
}

function getSnapshot(): TimerStateResult {
  return cachedSnapshot
}

function subscribe(callback: () => void): () => void {
  // Update snapshot immediately to get current state
  updateSnapshot()

  return timerMachine.subscribe(() => {
    updateSnapshot()
    callback()
  })
}

/**
 * Hook to subscribe to timer state. Only components using this hook
 * will re-render on every tick.
 */
export function useTimerState(): TimerStateResult {
  return useSyncExternalStore(subscribe, getSnapshot)
}
