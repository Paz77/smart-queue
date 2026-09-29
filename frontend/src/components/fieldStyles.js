// Shared by the form fields (TextField, TextAreaField, NumberField, SelectField).

export const errorId = (name) => `${name}-error`

// Ties a control to its label and error message.
export function controlProps(name, error) {
  return {
    id: name,
    name,
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? errorId(name) : undefined,
  }
}

// Border, background and focus ring shared by inputs, textareas and selects. Text color is left to each control.
export function controlClass(error) {
  return `w-full rounded-sm border bg-surface text-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/15'
      : 'border-line-strong focus:border-accent focus:ring-accent/15'
  }`
}
