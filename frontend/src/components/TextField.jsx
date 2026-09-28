// A labelled text input with its error shown underneath. Extra props go to the <input>.
export function TextField({ label, name, error, hint, ...inputProps }) {
  const errorId = `${name}-error`
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={name} className="block text-xs font-medium text-ink">
          {label}
        </label>
        {hint && <span className="text-[11px] text-ink-subtle tabular-nums">{hint}</span>}
      </div>
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
