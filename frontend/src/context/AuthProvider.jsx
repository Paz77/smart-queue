import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, clearToken, getToken, setToken } from '../api/client'
import { AuthContext } from './auth'

// Who is signed in, backed by the API.
//
// login/register/signInAs throw an ApiError when the server refuses, so the
// screens can read err.fields to put messages under the right input. The token
// is kept in localStorage by the client, so a reload stays signed in.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  // True until we know whether the stored token still works, so screens do not
  // flash "logged out" on every reload.
  const [restoring, setRestoring] = useState(Boolean(getToken()))

  useEffect(() => {
    if (!getToken()) return

    let cancelled = false
    api
      .get('/auth/me')
      .then((user) => {
        if (!cancelled) setCurrentUser(user)
      })
      .catch(() => {
        // The token expired or the server restarted and forgot it.
        clearToken()
      })
      .finally(() => {
        if (!cancelled) setRestoring(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (path, body) => {
    const { user, token } = await api.post(path, { body })
    setToken(token)
    setCurrentUser(user)
    return user
  }, [])

  const login = useCallback((email, password) => signIn('/auth/login', { email, password }), [signIn])

  const register = useCallback(
    ({ name, email, password }) => signIn('/auth/register', { name, email, password }),
    [signIn],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Already invalid server-side; dropping it locally is what matters.
    }
    clearToken()
    setCurrentUser(null)
  }, [])

  // Switch accounts without a password. Dev only, used by the developer tools.
  const signInAs = useCallback((userId) => signIn(`/dev/sign-in-as/${userId}`), [signIn])

  const value = useMemo(
    () => ({ currentUser, restoring, login, logout, register, signInAs }),
    [currentUser, restoring, login, logout, register, signInAs],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
