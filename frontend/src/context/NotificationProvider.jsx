import { useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { usePolling } from '../api/usePolling'
import { useAuth } from './auth'
import { NotificationContext } from './notifications'
import { useOrganization } from './organization'

// Notifications come from the server, which is what creates them when a queue
// moves. Polled every five seconds so a position change shows up without a
// refresh. Anything arriving that we have not seen before is also raised as a
// toast, so the person notices it rather than just the bell count changing.
export function NotificationProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])

  // Ids already on screen. Starts empty, and the first poll fills it without
  // toasting, so signing in does not bury the page under old notifications.
  const seen = useRef(null)

  const userId = currentUser?.id
  const organizationId = organization?.id

  const refresh = useCallback(async () => {
    if (!userId || !organizationId) {
      setNotifications([])
      seen.current = null
      return
    }

    const found = await api.get('/me/notifications', { params: { organizationId } })
    setNotifications(found)

    if (seen.current === null) {
      seen.current = new Set(found.map((n) => n.id))
      return
    }

    const fresh = found.filter((n) => !seen.current.has(n.id))
    for (const n of fresh) seen.current.add(n.id)
    if (fresh.length) setToasts((prev) => [...prev, ...fresh])
  }, [userId, organizationId])

  usePolling(refresh, { enabled: Boolean(userId && organizationId) })

  const markRead = useCallback(async (id) => {
    // Update straight away; the request only confirms it.
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await api.patch(`/me/notifications/${id}`, { body: { read: true } })
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)))
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!organizationId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await api.post('/me/notifications/read-all', { params: { organizationId } })
    } catch {
      refresh()
    }
  }, [organizationId, refresh])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Kept so the mock queue actions still raise a toast until the queue engine
  // lands and the server sends these itself. Local only: nothing is saved.
  const addNotification = useCallback(({ type, title, message }) => {
    const local = {
      id: `local-${crypto.randomUUID()}`,
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
      read: false,
    }
    setNotifications((prev) => [local, ...prev])
    setToasts((prev) => [...prev, local])
  }, [])

  // Used by the developer tools after resetting the demo data.
  const resetNotifications = useCallback(() => {
    seen.current = null
    setToasts([])
    return refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      toasts,
      refresh,
      addNotification,
      markRead,
      markAllRead,
      dismissToast,
      resetNotifications,
    }),
    [notifications, toasts, refresh, addNotification, markRead, markAllRead, dismissToast, resetNotifications],
  )

  return <NotificationContext value={value}>{children}</NotificationContext>
}
