import { useCallback, useMemo, useState } from 'react'
import { api } from '../api/client'
import { usePolling } from '../api/usePolling'
import { useAuth } from './auth'
import { useOrganization } from './organization'
import { ServiceContext } from './services'

// The organization's services, loaded from the API. Each one carries its line
// length (queueLength) and the wait for someone joining now (estimatedWait),
// so it is polled to keep those counts current. Split out of QueueProvider so
// the admin screens own their own data.
export function ServiceProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const [services, setServices] = useState([])
  // The organization the list was last loaded for, so screens can tell "no services" from "not loaded yet".
  const [loadedFor, setLoadedFor] = useState(null)

  const userId = currentUser?.id
  const organizationId = organization?.id
  const loaded = loadedFor === organizationId

  const refresh = useCallback(async () => {
    if (!userId || !organizationId) {
      setServices([])
      return
    }
    const found = await api.get(`/organizations/${organizationId}/services`)
    setServices(found)
    setLoadedFor(organizationId)
  }, [userId, organizationId])

  usePolling(refresh, { enabled: Boolean(userId && organizationId) })

  const getService = useCallback((serviceId) => services.find((s) => s.id === serviceId), [services])

  // Swap one service in the list for the version the server just returned.
  const replace = useCallback((saved) => {
    setServices((prev) => (prev.some((s) => s.id === saved.id) ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]))
    return saved
  }, [])

  // These throw an ApiError on failure; forms read error.fields to show messages under each field.
  const createService = useCallback(
    async (fields) => replace(await api.post(`/organizations/${organizationId}/services`, { body: fields })),
    [organizationId, replace],
  )

  const updateService = useCallback(
    async (serviceId, fields) => replace(await api.patch(`/services/${serviceId}`, { body: fields })),
    [replace],
  )

  // People already in line keep their place either way; the server tells them it opened or closed.
  const setServiceOpen = useCallback((serviceId, isOpen) => updateService(serviceId, { isOpen }), [updateService])

  const value = useMemo(
    () => ({ services, loaded, refresh, getService, createService, updateService, setServiceOpen }),
    [services, loaded, refresh, getService, createService, updateService, setServiceOpen],
  )

  return <ServiceContext value={value}>{children}</ServiceContext>
}
