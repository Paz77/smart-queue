import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { HOME_BY_ROLE } from './nav'

// Guards a group of routes by role. Signed-out visitors are sent to the login
// screen; anyone signed in with the wrong role goes to their own home instead,
// so a visitor cannot open the admin screens by typing the URL.
export function ProtectedRoute({ role }) {
  const { currentUser } = useAuth()
  const { pathname } = useLocation()

  if (!currentUser) return <Navigate to="/login" replace state={{ from: pathname }} />
  if (currentUser.role !== role) return <Navigate to={HOME_BY_ROLE[currentUser.role]} replace />

  return <Outlet />
}
