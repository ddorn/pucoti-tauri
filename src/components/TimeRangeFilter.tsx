import { ButtonGroup } from './ButtonGroup'
import type { TimeRange } from '../lib/stats'

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '1m', label: 'Last month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: 'all', label: 'All time' },
]

export function TimeRangeFilter({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return <ButtonGroup options={OPTIONS} value={value} onChange={onChange} />
}
