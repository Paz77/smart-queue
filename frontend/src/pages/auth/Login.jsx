import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/AuthCard'
import { Button } from '../../components/Button'
import { HOME_BY_ROLE } from '../../components/nav'
import { TextField } from '../../components/TextField'
import { useAuth } from '../../context/auth'
import { useOrganization } from '../../context/organization'
import { isEmail, required } from '../../utils/validation'

function validate(field, value) {
  if (field === 'email') return required(value, 'Email') || isEmail(value)
  return required(value, 'Password')
}

export default function Login() {
  const { login } = useAuth()
  const { setOrganizationId } = useOrganization()
  const navigate = useNavigate()

  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    // Clear a field's error as soon as it is fixed, but only re-check fields that already showed one.
    if (errors[name]) setErrors((current) => ({ ...current, [name]: validate(name, value) }))
    setFormError('')
  }

  function handleBlur(event) {
    const { name, value } = event.target
    setErrors((current) => ({ ...current, [name]: validate(name, value) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {
      email: validate('email', values.email),
      password: validate('password', values.password),
    }
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) return

    const user = login(values.email, values.password)
    if (!user) {
      setFormError('That email and password don’t match an account.')
      return
    }
    // Admins manage one organization, so show theirs.
    if (user.organizationId) setOrganizationId(user.organizationId)
    navigate(HOME_BY_ROLE[user.role] ?? HOME_BY_ROLE.user, { replace: true })
  }

  return (
    <AuthCard
      title="Log in"
      description="Welcome back. Sign in to see your queues."
      error={formError}
      onSubmit={handleSubmit}
      footer={
        <>
          New to QueueSmart?{' '}
          <Link to="/register" className="font-medium text-accent hover:text-accent-hover hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="mt-6 space-y-4">
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>

      <Button type="submit" className="mt-6 w-full">
        <LogIn />
        Log in
      </Button>
    </AuthCard>
  )
}
