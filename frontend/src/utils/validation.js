// Field checks shared by the forms. Each returns an error message, or '' when the value is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function required(value, label) {
  return String(value ?? '').trim() ? '' : `${label} is required.`
}

export function isEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim()) ? '' : 'Enter a valid email address.'
}

export function maxLength(value, max, label) {
  return String(value ?? '').trim().length <= max ? '' : `${label} must be ${max} characters or fewer.`
}

export function minLength(value, min, label) {
  return String(value ?? '').length >= min ? '' : `${label} must be at least ${min} characters.`
}
