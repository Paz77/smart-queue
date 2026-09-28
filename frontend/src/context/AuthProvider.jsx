import { useState } from 'react'
import { users } from '../mocks/users'
import { AuthContext } from './auth'

// Starts signed in as the sample visitor until the login screen is connected.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(users[0])

  function login(email, password) {
    const match = users.find(
      (user) => user.email === email.trim().toLowerCase() && user.password === password,
    )
    if (match) setCurrentUser(match)
    return match ?? null
  }

  function logout() {
    setCurrentUser(null)
  }

  // Switch accounts without a password. Used by the developer tools.
  function signInAs(userId) {
    const match = users.find((user) => user.id === userId)
    if (match) setCurrentUser(match)
  }

  return <AuthContext value={{ currentUser, login, logout, signInAs }}>{children}</AuthContext>
}
