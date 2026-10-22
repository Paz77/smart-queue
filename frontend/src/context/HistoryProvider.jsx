import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from './auth'
import { HistoryContext } from './history'
import { useOrganization } from './organization'

// Past visits for the signed-in person at the organization being shown.
// Split out of QueueProvider so the history screen owns its own data.
export function HistoryProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(false)

  const userId = currentUser?.id
  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!userId || !organizationId) {
      setVisits([])
      return
    }
    const found = await api.get('/me/history', { params: { organizationId } })
    setVisits(found)
  }, [userId, organizationId])

  // Reload whenever the person or the organization changes.
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        await refresh()
      } catch {
        if (!cancelled) setVisits([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [refresh])

  const value = useMemo(() => ({ history: visits, loading, refresh }), [visits, loading, refresh])

  return <HistoryContext value={value}>{children}</HistoryContext>
}
