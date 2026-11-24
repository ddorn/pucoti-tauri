import { useState, useEffect, useCallback } from 'react'
import type { Session } from '../lib/session'
import { platform } from '../lib/platform'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    return platform.loadSessions()
      .then(setSessions)
      .catch(err => {
        console.error('Failed to load sessions:', err)
        setError(err?.message || 'Failed to load sessions')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { sessions, loading, error, reload }
}
