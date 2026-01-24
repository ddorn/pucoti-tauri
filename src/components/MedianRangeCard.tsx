import { Heading } from './catalyst/heading'
import { Text } from './catalyst/text'
import type { CalibrationStats } from '../lib/stats'

export function MedianRangeCard({ stats }: { stats: CalibrationStats | null }) {
  if (!stats?.ratioIQR) {
    return (
      <div className="bg-surface-raised rounded-lg p-6 flex items-center justify-center">
        <Text className="text-center">Complete more sessions to see your typical range</Text>
      </div>
    )
  }

  const { q1, median, q3 } = stats.ratioIQR

  return (
    <div className="bg-surface-raised rounded-lg p-6">
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-xl mb-3">Half the time, you are between</div>
          <div className="text-4xl font-bold mb-1">
            <span className="text-blue-400">{q1.toFixed(2)}×</span>
            <span className="mx-3">and</span>
            <span className="text-blue-400">{q3.toFixed(2)}×</span>
          </div>
          <div className="text-xl">of your estimate</div>
        </div>

        <div className="border-t border-zinc-700 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <Text className="text-zinc-400">25% finish faster than</Text>
            <Text className="font-medium">{q1.toFixed(2)}× estimate</Text>
          </div>
          <div className="flex justify-between text-sm">
            <Text className="text-zinc-400">Median completion at</Text>
            <Text className="font-medium">{median.toFixed(2)}× estimate</Text>
          </div>
          <div className="flex justify-between text-sm">
            <Text className="text-zinc-400">75% finish by</Text>
            <Text className="font-medium">{q3.toFixed(2)}× estimate</Text>
          </div>
        </div>
      </div>
    </div>
  )
}
