import { useState } from 'react'
import { formatDuration, formatTime } from '../lib/format'
import type { Session } from '../lib/storage'
import { filterMeaningful } from '../lib/stats'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './catalyst/table'
import { Text } from './catalyst/text'
import { Switch } from './catalyst/switch'
import { Button } from './catalyst/button'
import { StatusBadge } from './StatusBadge'
import { Badge } from './catalyst/badge'

const badgeColors = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
] as const

function getTagColor(tag: string): typeof badgeColors[number] {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i)
    hash = hash & hash
  }
  return badgeColors[Math.abs(hash) % badgeColors.length]
}

export type SessionSortMode = 'all' | 'predictions' | 'most-underestimated' | 'most-overestimated' | 'best-calibrated'

const SORT_OPTIONS: { value: SessionSortMode; label: string; activeColor: string; inactiveClass: string }[] = [
  { value: 'all', label: 'All', activeColor: 'zinc', inactiveClass: 'text-zinc-400!' },
  { value: 'predictions', label: 'Predictions', activeColor: 'indigo', inactiveClass: 'text-indigo-400!' },
  { value: 'most-underestimated', label: 'Most underestimated', activeColor: 'red', inactiveClass: 'text-red-400!' },
  { value: 'most-overestimated', label: 'Most overestimated', activeColor: 'emerald', inactiveClass: 'text-emerald-400!' },
  { value: 'best-calibrated', label: 'Best calibrated', activeColor: 'amber', inactiveClass: 'text-amber-500!' },
]

function computeError(session: Session): number | null {
  if (session.predictedSeconds === 0) return null
  if (!session.tags.includes('mode:predict')) return null
  return ((session.actualSeconds - session.predictedSeconds) / session.predictedSeconds) * 100
}

function sortSessions(sessions: Session[], mode: SessionSortMode): Session[] {
  let base: Session[]
  if (mode === 'all') {
    base = sessions
  } else if (mode === 'predictions') {
    base = filterMeaningful(sessions).filter(s => s.tags.includes('mode:predict'))
  } else {
    base = filterMeaningful(sessions).filter(s => s.status === 'completed' && s.tags.includes('mode:predict'))
  }

  const sorted = [...base]
  switch (mode) {
    case 'all':
      sorted.reverse()
      break
    case 'predictions':
      sorted.reverse()
      break
    case 'most-underestimated':
      sorted.sort((a, b) => {
        const ea = (a.actualSeconds - a.predictedSeconds) / a.predictedSeconds
        const eb = (b.actualSeconds - b.predictedSeconds) / b.predictedSeconds
        return eb - ea // highest ratio first
      })
      break
    case 'most-overestimated':
      sorted.sort((a, b) => {
        const ea = (a.actualSeconds - a.predictedSeconds) / a.predictedSeconds
        const eb = (b.actualSeconds - b.predictedSeconds) / b.predictedSeconds
        return ea - eb // lowest ratio first
      })
      break
    case 'best-calibrated':
      sorted.sort((a, b) => {
        const ea = Math.abs(a.actualSeconds - a.predictedSeconds) / a.predictedSeconds
        const eb = Math.abs(b.actualSeconds - b.predictedSeconds) / b.predictedSeconds
        return ea - eb // smallest error first
      })
      break
  }
  return sorted
}

function formatError(error: number | null): { text: string; color: string } {
  if (error === null) return { text: '—', color: 'text-zinc-500' }
  const abs = Math.abs(Math.round(error))
  if (error > 0) return { text: `+${abs}%`, color: 'text-red-400' }
  if (error < 0) return { text: `−${abs}%`, color: 'text-amber-400' }
  return { text: 'exact', color: 'text-emerald-400' }
}

const PAGE_SIZE = 20

export function SessionTable({ sessions, initialSort }: {
  sessions: Session[]
  initialSort?: SessionSortMode
}) {
  const [relativeTime, setRelativeTime] = useState(true)
  const [page, setPage] = useState(0)
  const [sortMode, setSortMode] = useState<SessionSortMode>(initialSort ?? 'predictions')

  const sorted = sortSessions(sessions, sortMode)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSortChange = (mode: SessionSortMode) => {
    setSortMode(mode)
    setPage(0)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Text className="text-zinc-400">Filter</Text>
          <div className="flex gap-1 flex-wrap">
            {SORT_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                outline={opt.value !== sortMode}
                color={opt.activeColor}
                onClick={() => handleSortChange(opt.value)}
                className={opt.value !== sortMode ? opt.inactiveClass : ''}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Text>{relativeTime ? 'Relative time' : 'Absolute time'}</Text>
          <Switch checked={relativeTime} onChange={setRelativeTime} />
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Focus</TableHeader>
              <TableHeader>Predicted</TableHeader>
              <TableHeader>Actual</TableHeader>
              <TableHeader>Error</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Tags</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageItems.map((session, i) => {
              const error = computeError(session)
              const { text: errorText, color: errorColor } = formatError(error)
              return (
                <TableRow key={page * PAGE_SIZE + i}>
                  <TableCell className="whitespace-nowrap">
                    {formatTime(session.timestamp, relativeTime)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {session.focusText}
                  </TableCell>
                  <TableCell>
                    {formatDuration(session.predictedSeconds)}
                  </TableCell>
                  <TableCell>
                    {formatDuration(session.actualSeconds)}
                  </TableCell>
                  <TableCell className={errorColor}>
                    {errorText}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={session.status} />
                  </TableCell>
                  <TableCell>
                    {session.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {session.tags.map((tag, tagIdx) => (
                          <Badge
                            key={tagIdx}
                            color={getTagColor(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Text className="text-zinc-500">—</Text>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <Button
            plain
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <Text className="text-zinc-500">
            Page {page + 1} of {totalPages} ({sorted.length} sessions)
          </Text>
          <Button
            plain
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  )
}
