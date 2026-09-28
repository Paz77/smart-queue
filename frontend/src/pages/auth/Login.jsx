import { CircleAlert, LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../../components/Brand'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { FogBackdrop } from '../../components/FogBackdrop'
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <FogBackdrop />

      <div className="mb-8">
        <Brand />
      </div>

      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} noValidate className="px-6 py-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Log in</h1>
          <p className="mt-1.5 text-sm text-ink-muted">Welcome back. Sign in to see your queues.</p>

          {formError && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {formError}
            </p>
          )}

          <div className="mt-6 space-y-4">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            <Field
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
        </form>

        <p className="border-t border-line px-6 py-4 text-center text-xs text-ink-muted">
          New to QueueSmart?{' '}
          <Link to="/register" className="font-medium text-accent hover:text-accent-hover hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  )
}

function Field({ label, name, error, ...inputProps }) {
  const errorId = `${name}-error`
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`h-9 w-full rounded-sm border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
            : 'border-line-strong focus:border-accent focus:ring-accent/15'
        }`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
