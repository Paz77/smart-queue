// Field checks shared by the forms. Each returns an error message, or '' when the value is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function required(value, label) {
  return String(value ?? '').trim() ? '' : `${label} is required.`
}

export function isEmail(value) {
  return EMAIL_PATTERN.test(String(value ?? '').trim()) ? '' : 'Enter a valid email address.'
}
