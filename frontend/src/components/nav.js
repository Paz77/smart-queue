import { History, LayoutDashboard, ListPlus, Settings2, Timer, Users } from 'lucide-react'

// Where each role lands after signing in, and where the route guard sends
// anyone who opens a screen their role does not have.
export const HOME_BY_ROLE = {
  admin: '/admin/dashboard',
  user: '/app/dashboard',
}

export const USER_NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/join', label: 'Join a queue', icon: ListPlus },
  { to: '/app/status', label: 'Queue status', icon: Timer },
  { to: '/app/history', label: 'History', icon: History },
]

export const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/services', label: 'Services', icon: Settings2 },
  { to: '/admin/queues', label: 'Queues', icon: Users },
]
