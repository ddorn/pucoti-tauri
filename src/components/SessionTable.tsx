import { useState } from 'react'
import { formatDuration, formatTime } from '../lib/format'
import type { Session } from '../lib/storage'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './catalyst/table'
import { Text } from './catalyst/text'
import { Subheading } from './catalyst/heading'
import { Switch } from './catalyst/switch'
import { StatusBadge } from './StatusBadge'
import { Badge } from './catalyst/badge'

const badgeColors = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
] as const

function getTagColor(tag: string): typeof badgeColors[number] {
  // Simple hash function to deterministically assign colors
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash) + tag.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return badgeColors[Math.abs(hash) % badgeColors.length]
}

export function SessionTable({ sessions }: { sessions: Session[] }) {
  const [relativeTime, setRelativeTime] = useState(true)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <Subheading level={2}>All Sessions</Subheading>
        <div className="flex items-center gap-2">
          <Text className="text-sm">{relativeTime ? 'Relative time' : 'Absolute time'}</Text>
          <Switch checked={relativeTime} onChange={setRelativeTime} />
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Date</TableHeader>
              <TableHeader>Focus</TableHeader>
              <TableHeader>Predicted</TableHeader>
              <TableHeader>Actual</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Tags</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.slice().reverse().map((session, i) => (
              <TableRow key={i}>
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
                    <Text className="text-zinc-500 text-sm">—</Text>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
