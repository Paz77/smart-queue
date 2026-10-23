import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/AuthCard'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useAuth } from '../../context/auth'
import { useOrganization } from '../../context/organization'
import { isEmail, required } from '../../utils/validation'

const HOME_BY_ROLE = {
  admin: '/admin/dashboard',
  user: '/app/dashboard',
}

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
  const [busy, setBusy] = useState(false)

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

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {
      email: validate('email', values.email),
      password: validate('password', values.password),
    }
    setErrors(nextErrors)
    if (nextErrors.email || nextErrors.password) return

    setBusy(true)
    try {
      const user = await login(values.email, values.password)
      // Admins manage one organization, so show theirs.
      if (user.organizationId) setOrganizationId(user.organizationId)
      navigate(HOME_BY_ROLE[user.role] ?? HOME_BY_ROLE.user, { replace: true })
    } catch (cause) {
      // The server reports bad credentials as a whole-form problem, and anything
      // it blames on a field goes under that field.
      setErrors((current) => ({ ...current, ...cause.fields }))
      if (!cause.fields || Object.keys(cause.fields).length === 0) {
        setFormError(cause.message ?? 'Could not sign you in.')
      }
    } finally {
      setBusy(false)
    }
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

      <Button type="submit" className="mt-6 w-full" disabled={busy}>
        <LogIn />
        {busy ? 'Signing in…' : 'Log in'}
      </Button>
    </AuthCard>
  )
}
