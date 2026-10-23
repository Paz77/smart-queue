import { useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { usePolling } from '../api/usePolling'
import { useAuth } from './auth'
import { useHistory } from './history'
import { useNotifications } from './notifications'
import { useOrganization } from './organization'
import { QueueContext } from './queue'
import { useServices } from './services'

const isActive = (entry) => entry.status !== 'served'

// The signed-in person's place in line at the organization being shown, from the API.
// Polled so moving up, or being called to the desk, shows up without a refresh.
// The server creates the "Joined" and "Left" notifications itself.
//
// joinQueue, leaveQueue and clearServed throw an ApiError on failure, so screens
// can show the server's reason (the line closed, already in a line...).
export function QueueProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const { refresh: refreshNotifications } = useNotifications()
  const { refresh: refreshHistory } = useHistory()
  const { refresh: refreshServices } = useServices()

  const userId = currentUser?.id
  const organizationId = organization?.id
  // Who and where the entry was loaded for, so switching never shows someone else's line.
  const key = `${userId}/${organizationId}`
  const [loadedEntry, setLoadedEntry] = useState({ key: null, entry: null })
  // The entry on screen, so a poll can tell when a visit has just ended.
  const shown = useRef(null)

  const show = useCallback(
    (entry) => {
      shown.current = entry
      setLoadedEntry({ key, entry })
    },
    [key],
  )

  const refresh = useCallback(async () => {
    if (!userId || !organizationId) {
      show(null)
      return
    }
    const found = await api.get('/me/queue-entry', { params: { organizationId } })
    const before = shown.current
    // Called to the desk, or taken out of line by staff: either way that visit is in the history now.
    if (before && isActive(before) && (found?.id !== before.id || !isActive(found))) {
      refreshHistory().catch(() => {})
    }
    show(found)
  }, [userId, organizationId, show, refreshHistory])

  usePolling(refresh, { enabled: Boolean(userId && organizationId) })

  // A join or leave changes the line counts and the bell too, so catch those up now
  // rather than at their next poll.
  const catchUp = useCallback(() => {
    refreshServices().catch(() => {})
    refreshNotifications().catch(() => {})
  }, [refreshServices, refreshNotifications])

  // priority is "normal" or "priority".
  const joinQueue = useCallback(
    async (serviceId, priority = 'normal') => {
      const entry = await api.post(`/services/${serviceId}/queue`, { body: { priority } })
      show(entry)
      catchUp()
      return entry
    },
    [show, catchUp],
  )

  const leaveQueue = useCallback(async () => {
    await api.delete('/me/queue-entry', { params: { organizationId } })
    show(null)
    catchUp()
    refreshHistory().catch(() => {})
  }, [organizationId, show, catchUp, refreshHistory])

  // Done with the "it is your turn" card. Safe to call twice.
  const clearServed = useCallback(async () => {
    await api.delete('/me/queue-entry/served', { params: { organizationId } })
    show(null)
  }, [organizationId, show])

  const loaded = loadedEntry.key === key

  const value = useMemo(
    () => ({
      // The active entry, else a served one not yet dismissed, else null (also null until loaded).
      myEntry: loaded ? loadedEntry.entry : null,
      loaded,
      refresh,
      joinQueue,
      leaveQueue,
      clearServed,
    }),
    [loaded, loadedEntry.entry, refresh, joinQueue, leaveQueue, clearServed],
  )

  return <QueueContext value={value}>{children}</QueueContext>
}
