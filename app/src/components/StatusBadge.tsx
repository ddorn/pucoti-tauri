import { Badge } from './catalyst/badge'
import type { Session } from '../lib/storage'

export function StatusBadge({ status }: { status: Session['status'] }) {
  switch (status) {
    case 'completed':
      return <Badge color="green">completed</Badge>
    case 'canceled':
      return <Badge color="zinc">canceled</Badge>
    case 'unknown':
      return <Badge color="amber">unknown</Badge>
  }
}
