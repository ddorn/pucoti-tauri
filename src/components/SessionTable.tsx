import { useState } from 'react'
import { formatDuration, formatTime } from '../lib/format'
import type { Session } from '../lib/storage'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './catalyst/table'
import { Text } from './catalyst/text'
import { Subheading } from './catalyst/heading'
import { Switch } from './catalyst/switch'
import { StatusBadge } from './StatusBadge'

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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
