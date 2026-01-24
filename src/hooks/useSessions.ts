import { useState, useEffect } from 'react'
import { loadSessions, type Session } from '../lib/storage'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
      .then(setSessions)
      .catch(err => {
        console.error('Failed to load sessions:', err)
        setError(err?.message || 'Failed to load sessions')
      })
      .finally(() => setLoading(false))
  }, [])

  return { sessions, loading, error }
}
