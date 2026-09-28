import { LogOut } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useOrganization } from '../context/organization'
import { Brand } from './Brand'
import { Button } from './Button'
import { ADMIN_NAV, USER_NAV } from './nav'
import { NotificationBell } from './NotificationBell'

export function TopBar() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const { organization, personLabel } = useOrganization()
  const isAdmin = useLocation().pathname.startsWith('/admin')
  const initials = currentUser?.name
    .split(' ')
    .map((part) => part[0])
    .join('')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-surface/70 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Brand />
          <span aria-hidden="true" className="hidden h-5 w-px bg-line-strong sm:block" />
          <span className="hidden truncate text-sm text-ink-muted sm:block">{organization.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {currentUser && (
            <div className="flex items-center gap-2.5 border-l border-line pl-3">
              <span className="grid size-8 place-items-center rounded-sm bg-accent-soft text-xs font-semibold text-accent">
                {initials}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-medium text-ink">{currentUser.name}</p>
                <p className="text-xs text-ink-subtle">{currentUser.role === 'admin' ? 'Admin' : personLabel}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Log out" title="Log out" className="px-2">
                <LogOut />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Compact nav for small screens, where the side menu is hidden. */}
      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1.5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        {(isAdmin ? ADMIN_NAV : USER_NAV).map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
