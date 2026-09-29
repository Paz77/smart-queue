import { Field } from './Field'
import { controlClass, controlProps } from './fieldStyles'

// A labelled text input with its error shown underneath. Extra props go to the <input>.
export function TextField({ label, name, error, hint, hintError, ...inputProps }) {
  return (
    <Field label={label} name={name} hint={hint} hintError={hintError} error={error}>
      <input {...controlProps(name, error)} className={`h-9 px-3 text-ink ${controlClass(error)}`} {...inputProps} />
    </Field>
  )
}
