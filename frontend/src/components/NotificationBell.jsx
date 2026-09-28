import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../context/notifications'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell() {
  const { unreadCount } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event) {
      if (!wrapperRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className={`relative grid size-9 place-items-center rounded-sm border transition-colors ${
          open
            ? 'border-line-strong bg-sunken text-ink'
            : 'border-transparent text-ink-muted hover:bg-sunken hover:text-ink'
        }`}
      >
        <Bell className="size-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-xs bg-accent px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationPanel />}
    </div>
  )
}
