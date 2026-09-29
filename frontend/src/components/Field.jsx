import { errorId } from './fieldStyles'

// The frame every form field shares: label with an optional hint on the right,
// the control itself, and the error underneath.
export function Field({ label, name, hint, hintError = false, error, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={name} className="block text-xs font-medium text-ink">
          {label}
        </label>
        {hint && (
          <span className={`text-[11px] tabular-nums ${hintError ? 'font-medium text-red-700' : 'text-ink-subtle'}`}>{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p id={errorId(name)} className="mt-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
