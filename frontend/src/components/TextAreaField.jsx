import { Field } from './Field'
import { controlClass, controlProps } from './fieldStyles'

// A labelled multi-line input, styled like TextField. Extra props go to the <textarea>.
export function TextAreaField({ label, name, error, hint, hintError, rows = 4, ...textareaProps }) {
  return (
    <Field label={label} name={name} hint={hint} hintError={hintError} error={error}>
      <textarea
        {...controlProps(name, error)}
        rows={rows}
        className={`block min-h-24 resize-y px-3 py-2 leading-5 text-ink ${controlClass(error)}`}
        {...textareaProps}
      />
    </Field>
  )
}
