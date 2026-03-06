import { Button } from './catalyst/button'
import type { TimeRange } from '../lib/stats'

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: 'Last month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: 'all', label: 'All time' },
]

export function TimeRangeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map(opt => (
        <Button
          key={opt.value}
          outline={opt.value !== value}
          plain={opt.value !== value}
          color={opt.value === value ? 'zinc' : undefined}
          onClick={() => onChange(opt.value)}
          className="text-sm! px-3! py-1!"
        >
          {opt.label}
        </Button>
      ))}
    </div>
  )
}
