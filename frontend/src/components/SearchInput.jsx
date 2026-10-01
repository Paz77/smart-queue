import { Search, X } from 'lucide-react'
import { controlClass } from './fieldStyles'

const SEARCH_MAX_LENGTH = 100

// The one search field used across the app: magnifier on the left, clear button
// on the right once there is something to clear. The label is visually hidden,
// so the placeholder carries the meaning on screen and screen readers still get
// a proper name.
export function SearchInput({ label, value, onChange, placeholder = 'Search', className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <Search
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle"
      />
      <input
        type="search"
        value={value}
        maxLength={SEARCH_MAX_LENGTH}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`h-9 pr-8 pl-8 text-ink ${controlClass(false)} [&::-webkit-search-cancel-button]:hidden`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-xs text-ink-subtle hover:bg-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  )
}
