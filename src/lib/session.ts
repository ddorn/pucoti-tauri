export type SessionStatus = 'completed' | 'canceled' | 'unknown'

export interface Session {
  timestamp: Date
  focusText: string
  predictedSeconds: number
  actualSeconds: number
  status: SessionStatus
  tags: string[]
}
