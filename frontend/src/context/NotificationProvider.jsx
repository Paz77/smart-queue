import { useCallback, useMemo, useState } from 'react'
import { createNotifications } from '../mocks/notifications'
import { useAuth } from './auth'
import { NotificationContext } from './notifications'
import { useOrganization } from './organization'

let nextId = 1

export function NotificationProvider({ children }) {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const [all, setAll] = useState(createNotifications)
  const [toasts, setToasts] = useState([])

  const userId = currentUser?.id

  const addNotification = useCallback(
    ({ organizationId, type, title, message }) => {
      const notification = {
        id: `n-live-${nextId++}`,
        userId,
        organizationId,
        type,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      }
      setAll((prev) => [notification, ...prev])
      setToasts((prev) => [...prev, notification])
    },
    [userId],
  )

  const markRead = useCallback((id) => {
    setAll((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllRead = useCallback(() => {
    setAll((prev) =>
      prev.map((n) => (n.userId === userId && n.organizationId === organization.id ? { ...n, read: true } : n)),
    )
  }, [userId, organization.id])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Put an organization's notifications back to the sample set.
  const resetNotifications = useCallback((organizationId) => {
    const fresh = createNotifications().filter((n) => n.organizationId === organizationId)
    setAll((prev) => [...prev.filter((n) => n.organizationId !== organizationId), ...fresh])
    setToasts([])
  }, [])

  const value = useMemo(() => {
    // Only the signed-in person's notifications for the organization being shown.
    const notifications = all
      .filter((n) => n.userId === userId && n.organizationId === organization.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return {
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      toasts,
      addNotification,
      markRead,
      markAllRead,
      dismissToast,
      resetNotifications,
    }
  }, [all, userId, organization.id, toasts, addNotification, markRead, markAllRead, dismissToast, resetNotifications])

  return <NotificationContext value={value}>{children}</NotificationContext>
}
