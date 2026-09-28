import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useNotifications } from '../context/notifications'
import { NOTIFICATION_TYPES } from './notificationTypes'

const TOAST_DURATION_MS = 5000

// Short-lived pop-ups for new notifications. The full list lives in the bell panel.
export function NotificationToaster() {
  const { toasts, dismissToast } = useNotifications()

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.slice(-3).map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const Icon = NOTIFICATION_TYPES[toast.type].icon

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className="pointer-events-auto flex gap-3 rounded-sm border border-line border-l-[3px] border-l-accent bg-surface py-3 pr-2 pl-3 shadow-[0_12px_32px_-12px_rgba(22,24,29,0.3)] motion-safe:animate-toast-in">
      <Icon className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{toast.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="grid size-6 shrink-0 place-items-center rounded-sm text-ink-subtle hover:bg-sunken hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
