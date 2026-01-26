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

  const predictionSessions = useMemo(
    () => completedSessions.filter(s => s.tags.includes('mode:predict')),
    [completedSessions]
  )

  const regression = useMemo(() => {
    const points = predictionSessions.map(s => ({
      x: s.predictedSeconds / 60,
      y: s.actualSeconds / 60,
    }))
    return computeRegressionWithCI(points)
  }, [predictionSessions])

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
