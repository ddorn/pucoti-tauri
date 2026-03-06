import { Subheading } from './catalyst/heading'
import { Text } from './catalyst/text'
import { Button } from './catalyst/button'
import { formatDuration, formatRelativeTime } from '../lib/format'
import type { NotableSession } from '../hooks/useStats'
import type { SessionSortMode } from './SessionTable'

function SessionRow({ item, type }: { item: NotableSession; type: 'under' | 'over' | 'accurate' }) {
  const s = item.session
  const predicted = formatDuration(s.predictedSeconds)
  const actual = formatDuration(s.actualSeconds)
  const label = s.focusText || 'Untitled'
  const when = formatRelativeTime(s.timestamp)

  let badge: string
  let badgeColor: string
  if (type === 'under') {
    badge = `+${Math.round(item.errorPercent)}%`
    badgeColor = 'text-red-400'
  } else if (type === 'over') {
    badge = `−${Math.round(item.errorPercent)}%`
    badgeColor = 'text-amber-400'
  } else {
    badge = item.errorPercent < 1 ? 'exact' : `±${Math.round(item.errorPercent)}%`
    badgeColor = 'text-emerald-400'
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-zinc-200 truncate">{label}</div>
        <div className="text-zinc-500 text-sm">{predicted} planned, {actual} actual &middot; {when}</div>
      </div>
      <div className={`font-medium whitespace-nowrap ${badgeColor}`}>{badge}</div>
    </div>
  )
}

function SessionList({ items, type, title, sortMode, onSeeAll }: {
  items: NotableSession[]
  type: 'under' | 'over' | 'accurate'
  title: string
  sortMode: SessionSortMode
  onSeeAll: (sort: SessionSortMode) => void
}) {
  return (
    <div className="bg-surface-raised rounded-lg p-4 flex flex-col">
      <Subheading level={2} className="mb-3">{title}</Subheading>
      {items.length > 0 ? (
        <>
          <div className="divide-y divide-zinc-800 flex-1">
            {items.map((item, i) => (
              <SessionRow key={i} item={item} type={type} />
            ))}
          </div>
          <div className="flex justify-end mt-3 pt-2 border-t border-zinc-800 mt-auto">
            <Button plain onClick={() => onSeeAll(sortMode)} className="text-sm!">
              See all
            </Button>
          </div>
        </>
      ) : (
        <Text>No data yet</Text>
      )}
    </div>
  )
}

interface Props {
  mostUnderestimated: NotableSession[]
  mostOverestimated: NotableSession[]
  bestCalibrated: NotableSession[]
  onSeeAll: (sort: SessionSortMode) => void
}

export function NotableSessions({ mostUnderestimated, mostOverestimated, bestCalibrated, onSeeAll }: Props) {
  if (mostUnderestimated.length === 0 && mostOverestimated.length === 0 && bestCalibrated.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SessionList items={mostUnderestimated} type="under" title="Most Underestimated" sortMode="most-underestimated" onSeeAll={onSeeAll} />
      <SessionList items={mostOverestimated} type="over" title="Most Overestimated" sortMode="most-overestimated" onSeeAll={onSeeAll} />
      <SessionList items={bestCalibrated} type="accurate" title="Best Calibrated" sortMode="best-calibrated" onSeeAll={onSeeAll} />
    </div>
  )
}
