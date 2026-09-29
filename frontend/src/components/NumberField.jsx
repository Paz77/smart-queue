import { Field } from './Field'
import { controlClass, controlProps } from './fieldStyles'

// A labelled number input with an optional unit inside the box, e.g. suffix="min".
// The browser's spinner arrows are hidden to keep the box clean. Extra props go to the <input>.
export function NumberField({ label, name, error, hint, hintError, suffix, ...inputProps }) {
  return (
    <Field label={label} name={name} hint={hint} hintError={hintError} error={error}>
      <div className="relative">
        <input
          {...controlProps(name, error)}
          type="number"
          inputMode="numeric"
          className={`h-9 pl-3 text-ink tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
            suffix ? 'pr-11' : 'pr-3'
          } ${controlClass(error)}`}
          {...inputProps}
        />
        {suffix && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-subtle">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}
