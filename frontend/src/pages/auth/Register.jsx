import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard } from '../../components/AuthCard'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useAuth } from '../../context/auth'
import { isEmail, maxLength, minLength, required } from '../../utils/validation'

const NAME_MAX_LENGTH = 100
const PASSWORD_MIN_LENGTH = 8
const FIELDS = ['name', 'email', 'password', 'confirmPassword']
const EMPTY = { name: '', email: '', password: '', confirmPassword: '' }

export default function Register() {
  const { register, isEmailTaken } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState(EMPTY)

  // Checks one field against the whole form, since "confirm password" depends on "password".
  function validate(field, form) {
    const value = form[field]
    switch (field) {
      case 'name':
        return required(value, 'Name') || maxLength(value, NAME_MAX_LENGTH, 'Name')
      case 'email':
        return (
          required(value, 'Email') ||
          isEmail(value) ||
          (isEmailTaken(value) ? 'An account with this email already exists.' : '')
        )
      case 'password':
        return required(value, 'Password') || minLength(value, PASSWORD_MIN_LENGTH, 'Password')
      case 'confirmPassword':
        return required(value, 'Please confirm your password') || (value === form.password ? '' : 'Passwords don’t match.')
      default:
        return ''
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    const next = { ...values, [name]: value }
    setValues(next)
    // Only re-check fields that already show an error, so nothing turns red while typing.
    setErrors((current) => {
      const updated = { ...current }
      if (current[name]) updated[name] = validate(name, next)
      if (name === 'password' && current.confirmPassword) updated.confirmPassword = validate('confirmPassword', next)
      return updated
    })
  }

  function handleBlur(event) {
    const { name } = event.target
    setErrors((current) => ({ ...current, [name]: validate(name, values) }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = Object.fromEntries(FIELDS.map((field) => [field, validate(field, values)]))
    setErrors(nextErrors)
    if (FIELDS.some((field) => nextErrors[field])) return

    const user = register(values)
    if (!user) {
      setErrors((current) => ({ ...current, email: 'An account with this email already exists.' }))
      return
    }
    navigate('/app/dashboard', { replace: true })
  }

  return (
    <AuthCard
      title="Create an account"
      description="Join queues and get notified when it’s your turn."
      onSubmit={handleSubmit}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:text-accent-hover hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <div className="mt-6 space-y-4">
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          maxLength={NAME_MAX_LENGTH}
          hint={`${values.name.length}/${NAME_MAX_LENGTH}`}
          value={values.name}
          error={errors.name}
          onChange={handleChange}
          onBlur={handleBlur}
        />
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
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
          value={values.password}
          error={errors.password}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>

      <Button type="submit" className="mt-6 w-full">
        <UserPlus />
        Create account
      </Button>
    </AuthCard>
  )
}
