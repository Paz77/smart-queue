import { BellOff } from 'lucide-react'
import { useState } from 'react'
import { useNotifications } from '../context/notifications'
import { formatRelative } from '../utils/format'
import { NOTIFICATION_TYPES } from './notificationTypes'

export function NotificationPanel() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState('all')

  const visible = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const tabs = [
    { value: 'all', label: 'All', count: notifications.length },
    { value: 'unread', label: 'Unread', count: unreadCount },
  ]

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute top-full right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(22,24,29,0.28)] motion-safe:animate-pop-in"
    >
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {unreadCount ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={!unreadCount}
          className="text-xs font-medium text-accent hover:underline disabled:text-ink-subtle disabled:no-underline"
        >
          Mark all as read
        </button>
      </div>

      <div role="tablist" aria-label="Filter notifications" className="flex gap-4 border-b border-line px-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-xs font-medium transition-colors ${
              filter === tab.value
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
            <span className="rounded-xs bg-stone-100 px-1.5 py-px text-[10px] text-ink-muted tabular-nums">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <BellOff className="size-5 text-ink-subtle" strokeWidth={1.75} />
          <p className="mt-3 text-sm font-medium text-ink">No unread notifications</p>
          <p className="mt-1 text-xs text-ink-muted">Queue and status updates will appear here.</p>
        </div>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
          {visible.map((notification) => {
            const type = NOTIFICATION_TYPES[notification.type]
            const Icon = type.icon
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => markRead(notification.id)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-sunken ${
                    notification.read ? '' : 'bg-accent-soft/50'
                  }`}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-sm border border-line bg-surface text-ink-muted">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${notification.read ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                      {notification.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{notification.message}</span>
                    <span className="mt-1.5 block text-[11px] text-ink-subtle">
                      {type.label} &middot; {formatRelative(notification.createdAt)}
                    </span>
                  </span>
                  {!notification.read && (
                    <span aria-label="Unread" className="mt-2 size-2 shrink-0 bg-accent" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
