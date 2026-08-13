import { useState, useEffect } from 'react'
import type { Session } from '../lib/session'
import { platform } from '../lib/platform'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    platform.loadSessions()
      .then(setSessions)
      .catch(err => {
        console.error('Failed to load sessions:', err)
        setError(err?.message || 'Failed to load sessions')
      })
      .finally(() => setLoading(false))
  }, [])

  return { sessions, loading, error }
}
