import { History, LayoutDashboard, ListPlus, Settings2, Timer, Users } from 'lucide-react'

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
