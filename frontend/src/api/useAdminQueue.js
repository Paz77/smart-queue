import { useCallback, useState } from 'react'
import { api } from './client'
import { usePolling } from './usePolling'

// One service's line as admins see it, polled so people joining or leaving show up.
//
//   const { queue, serveNext, moveEntry, removeEntry } = useAdminQueue(service.id)
//
// queue is { service, entries, lastCalled }, or null until the first load.
// Every action returns the updated line from the server, so the screen redraws
// from that response rather than waiting for the next poll. Actions throw an
// ApiError on failure.
export function useAdminQueue(serviceId) {
  const [queue, setQueue] = useState(null)

  const refresh = useCallback(async () => {
    setQueue(await api.get(`/admin/services/${serviceId}/queue`))
  }, [serviceId])

  usePolling(refresh, { enabled: Boolean(serviceId) })

  const apply = useCallback(async (request) => {
    const updated = await request
    setQueue(updated)
    return updated
  }, [])

  const serveNext = useCallback(() => apply(api.post(`/admin/services/${serviceId}/serve-next`)), [apply, serviceId])

  const moveEntry = useCallback(
    (entryId, position) => apply(api.patch(`/admin/queue-entries/${entryId}`, { body: { position } })),
    [apply],
  )

  const setEntryPriority = useCallback(
    (entryId, priority) => apply(api.patch(`/admin/queue-entries/${entryId}`, { body: { priority } })),
    [apply],
  )

  const removeEntry = useCallback((entryId) => apply(api.delete(`/admin/queue-entries/${entryId}`)), [apply])

  return { queue, refresh, serveNext, moveEntry, setEntryPriority, removeEntry }
}
