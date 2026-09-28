import { useState } from 'react'
import { users } from '../mocks/users'
import { AuthContext } from './auth'

const normalizeEmail = (email) => email.trim().toLowerCase()

// Starts signed in as the sample visitor until the login screen is connected.
// Accounts created with register() last until the page reloads.
export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(users)
  const [currentUser, setCurrentUser] = useState(users[0])

  function login(email, password) {
    const match = accounts.find((user) => user.email === normalizeEmail(email) && user.password === password)
    if (match) setCurrentUser(match)
    return match ?? null
  }

  function logout() {
    setCurrentUser(null)
  }

  function isEmailTaken(email) {
    return accounts.some((user) => user.email === normalizeEmail(email))
  }

  // Creates a visitor account and signs in as it. Returns null if the email is already used.
  function register({ name, email, password }) {
    if (isEmailTaken(email)) return null
    const user = {
      id: `u-${crypto.randomUUID()}`,
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      role: 'user',
      organizationId: null,
    }
    setAccounts((current) => [...current, user])
    setCurrentUser(user)
    return user
  }

  // Switch accounts without a password. Used by the developer tools.
  function signInAs(userId) {
    const match = accounts.find((user) => user.id === userId)
    if (match) setCurrentUser(match)
  }

  return (
    <AuthContext value={{ currentUser, login, logout, register, isEmailTaken, signInAs }}>{children}</AuthContext>
  )
}
