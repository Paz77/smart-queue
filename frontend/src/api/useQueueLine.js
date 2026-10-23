import { useCallback, useState } from 'react'
import { api } from './client'
import { usePolling } from './usePolling'

// One service's line as visitors see it, polled so people joining or leaving show up.
//
//   const { line } = useQueueLine(service.id)
//
// line is { serviceId, isOpen, length, entries, joinPosition, joinWait,
// priorityJoinPosition, priorityJoinWait }, or null until the first load.
// Entries carry no names: just each spot's id, position and status, and isMe for yours.
// Pass null to load nothing.
export function useQueueLine(serviceId) {
  const [line, setLine] = useState(null)

  const refresh = useCallback(async () => {
    setLine(await api.get(`/services/${serviceId}/queue`))
  }, [serviceId])

  usePolling(refresh, { enabled: Boolean(serviceId) })

  // The last line loaded may be another service's until the next poll catches up.
  return { line: line?.serviceId === serviceId ? line : null, refresh }
}
