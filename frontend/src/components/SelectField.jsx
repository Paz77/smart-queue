import { ChevronDown } from 'lucide-react'
import { Field } from './Field'
import { controlClass, controlProps } from './fieldStyles'

// A labelled dropdown, styled like TextField. options is a list of { value, label };
// placeholder is shown (greyed out) until something is chosen. Extra props go to the <select>.
export function SelectField({ label, name, error, hint, hintError, options, placeholder, value, ...selectProps }) {
  return (
    <Field label={label} name={name} hint={hint} hintError={hintError} error={error}>
      <div className="relative">
        <select
          {...controlProps(name, error)}
          value={value}
          className={`h-9 cursor-pointer appearance-none pr-9 pl-3 [&>option]:text-ink ${value ? 'text-ink' : 'text-ink-subtle'} ${controlClass(error)}`}
          {...selectProps}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-subtle"
        />
      </div>
    </Field>
  )
}
