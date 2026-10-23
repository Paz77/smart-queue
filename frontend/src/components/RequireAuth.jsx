import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

const HOME_BY_ROLE = {
  admin: '/admin/dashboard',
  user: '/app/dashboard',
}

const homeFor = (user) => HOME_BY_ROLE[user.role] ?? HOME_BY_ROLE.user

// Shows its children only to a signed-in user with the given role. Anyone
// else is sent to the login page or to their own home page.
export function RequireAuth({ role, children }) {
  const { currentUser, restoring } = useAuth()

  // Wait until a stored token has been checked, or every reload lands on /login.
  if (restoring) return null
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== role) return <Navigate to={homeFor(currentUser)} replace />
  return children
}

// For the login and register pages: someone already signed in goes home instead.
export function RedirectIfSignedIn({ children }) {
  const { currentUser, restoring } = useAuth()

  if (restoring) return null
  if (currentUser) return <Navigate to={homeFor(currentUser)} replace />
  return children
}
