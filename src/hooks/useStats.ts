import { useMemo } from 'react'
import type { Session } from '../lib/storage'
import {
  computeCalibrationStats,
  computeRegressionWithCI,
  computeAdjustmentCurve,
} from '../lib/stats'

export function useStats(sessions: Session[]) {
  const completedSessions = useMemo(
    () => sessions.filter(s => s.status === 'completed'),
    [sessions]
  )

  const regression = useMemo(() => {
    const points = completedSessions.map(s => ({
      x: s.predictedSeconds / 60,
      y: s.actualSeconds / 60,
    }))
    return computeRegressionWithCI(points)
  }, [completedSessions])

  const stats = useMemo(
    () => computeCalibrationStats(sessions),
    [sessions]
  )

  const adjustmentCurve = useMemo(
    () => computeAdjustmentCurve(sessions),
    [sessions]
  )

  return {
    completedSessions,
    regression,
    stats,
    adjustmentCurve,
  }
}
