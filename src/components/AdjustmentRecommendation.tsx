import { Text } from './catalyst/text'
import type { AdjustmentCurve } from '../lib/stats'

export function AdjustmentRecommendation({
  adjustmentCurve,
  sessionCount
}: {
  adjustmentCurve: AdjustmentCurve | null
  sessionCount: number
}) {
  if (!adjustmentCurve || adjustmentCurve.adjustment80 === null) {
    return (
      <div className="bg-surface-raised rounded-lg p-6 flex items-center justify-center h-full min-h-[300px]">
        <Text>Complete more sessions to see planning adjustment recommendation</Text>
      </div>
    )
  }

  return (
    <div className="bg-surface-raised rounded-lg p-6 flex flex-col justify-center h-full min-h-[300px]">
      <div className="text-center">
        <div className="text-xl mb-3">To be on time 80% of the time</div>
        <div className="text-4xl font-bold mb-2">
          {adjustmentCurve.adjustment80 > 0 ? (
            <>
              <span className="text-accent">Add {Math.round(adjustmentCurve.adjustment80)}%</span>
              <span> to your estimates</span>
            </>
          ) : adjustmentCurve.adjustment80 < 0 ? (
            <>
              <span className="text-emerald-400">Subtract {Math.round(Math.abs(adjustmentCurve.adjustment80))}%</span>
              <span> from your estimates</span>
            </>
          ) : (
            <span className="text-emerald-400">Your estimates are spot on!</span>
          )}
        </div>
        <Text className="text-zinc-400">
          Based on {sessionCount} completed sessions
        </Text>
      </div>
    </div>
  )
}
