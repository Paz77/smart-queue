import { useCallback, useMemo, useState } from 'react'
import { api } from '../api/client'
import { usePolling } from '../api/usePolling'
import { useAuth } from './auth'
import { useHistory } from './history'
import { useOrganization } from './organization'
import { QueueContext } from './queue'
import { useServices } from './services'

// The signed-in person's place in line, from the API.
//
// Only one line is fetched in detail: the one they are standing in, which is
// all any screen draws position-by-position. Counts for every other service
// come from ServiceProvider, which already polls queueLength per service.
//
// Polled every five seconds, so a position change made by an admin shows up
// without a refresh.
export function QueueProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const { services, getService, refresh: refreshServices } = useServices()
  const { refresh: refreshHistory, history } = useHistory()

  const [myEntry, setMyEntry] = useState(null)
  const [myLine, setMyLine] = useState(null)

  const userId = currentUser?.id
  const organizationId = organization?.id
  const params = useMemo(() => ({ organizationId }), [organizationId])

  const refresh = useCallback(async () => {
    if (!userId || !organizationId) {
      setMyEntry(null)
      setMyLine(null)
      return
    }

    const entry = await api.get('/me/queue-entry', { params })
    setMyEntry(entry)

    // A served entry is no longer standing in the line, so there is none to draw.
    if (!entry || entry.status === 'served') {
      setMyLine(null)
      return
    }
    setMyLine(await api.get(`/services/${entry.serviceId}/queue`))
  }, [userId, organizationId, params])

  usePolling(refresh, { enabled: Boolean(userId && organizationId) })

  // Everything a screen draws per-person is about the line the person is in.
  // For any other service only the count is ever read, so it is filled from the
  // service's own queueLength rather than fetching every line on every poll.
  const entriesFor = useCallback(
    (serviceId) => {
      if (myLine && myLine.serviceId === serviceId) return myLine.entries
      const length = getService(serviceId)?.queueLength ?? 0
      return Array.from({ length }, (_, index) => ({ id: `${serviceId}-${index + 1}`, position: index + 1 }))
    },
    [myLine, getService],
  )

  // Reload the things a queue change affects: the line, the per-service counts,
  // and (when someone leaves or is served) their history.
  const reload = useCallback(async () => {
    await Promise.all([refresh(), refreshServices(), refreshHistory()])
  }, [refresh, refreshServices, refreshHistory])

  // Throws an ApiError when the queue is closed or they are already in one,
  // so the Join screen can show the server's message.
  const joinQueue = useCallback(
    async (serviceId, priority = 'normal') => {
      const entry = await api.post(`/services/${serviceId}/queue`, { body: { priority } })
      await reload()
      return entry
    },
    [reload],
  )

  const leaveQueue = useCallback(async () => {
    await api.delete('/me/queue-entry', { params })
    await reload()
  }, [params, reload])

  // Dismiss a served entry, so the "it's your turn" card goes away.
  const clearServed = useCallback(async () => {
    await api.delete('/me/queue-entry/served', { params })
    await reload()
  }, [params, reload])

  // --- admin actions, used by the developer tools -------------------------

  const serveNext = useCallback(
    async (serviceId) => {
      const served = await api.post(`/admin/services/${serviceId}/serve-next`)
      await reload()
      return served
    },
    [reload],
  )

  const serveEntry = useCallback(
    async (entryId) => {
      // Serving a specific person is a move to the front, then serve next.
      await api.patch(`/admin/queue-entries/${entryId}`, { body: { position: 1 } })
      const entry = myEntry?.id === entryId ? myEntry : null
      const serviceId = entry?.serviceId ?? myLine?.serviceId
      const served = serviceId ? await api.post(`/admin/services/${serviceId}/serve-next`) : null
      await reload()
      return served
    },
    [myEntry, myLine, reload],
  )

  const moveEntry = useCallback(
    async (entryId, position) => {
      await api.patch(`/admin/queue-entries/${entryId}`, { body: { position } })
      await reload()
    },
    [reload],
  )

  const removeEntry = useCallback(
    async (entryId) => {
      await api.delete(`/admin/queue-entries/${entryId}`)
      await reload()
    },
    [reload],
  )

  // Put the whole demo back to its sample data. Dev only.
  const resetOrganization = useCallback(async () => {
    await api.post('/dev/reset')
    await reload()
  }, [reload])

  const value = useMemo(
    () => ({
      services,
      history,
      myEntry,
      myLine,
      getService,
      entriesFor,
      refresh,
      joinQueue,
      leaveQueue,
      clearServed,
      serveEntry,
      serveNext,
      moveEntry,
      removeEntry,
      resetOrganization,
    }),
    [
      services,
      history,
      myEntry,
      myLine,
      getService,
      entriesFor,
      refresh,
      joinQueue,
      leaveQueue,
      clearServed,
      serveEntry,
      serveNext,
      moveEntry,
      removeEntry,
      resetOrganization,
    ],
  )

  return <QueueContext value={value}>{children}</QueueContext>
}
