import { CornerDownLeft, Search, SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useOrganization } from '../context/organization'
import { useQueue } from '../context/queue'
import { estimateWait, formatWait } from '../utils/format'
import { ADMIN_NAV, USER_NAV } from './nav'
import { StatusDot } from './StatusDot'

// Where a service leads depends on who is looking: visitors go to the screen
// where they can join it, admins to the queue they run.
const serviceLink = (service, isAdmin) =>
  isAdmin ? `/admin/queues/${service.id}` : `/app/join?service=${service.id}`

const matches = (text, query) => text.toLowerCase().includes(query)

export function SearchDialog({ open, onClose }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const { services, entriesFor } = useQueue()

  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Services first, then the pages themselves, so typing "hist" still gets you somewhere.
  const results = useMemo(() => {
    const search = query.trim().toLowerCase()

    const serviceHits = services
      .filter((service) => !search || matches(service.name, search) || matches(service.description, search))
      .map((service) => {
        const waiting = entriesFor(service.id).length
        return {
          id: service.id,
          kind: 'service',
          label: service.name,
          detail: service.isOpen
            ? `${waiting} in line · ~${formatWait(estimateWait(waiting + 1, service.expectedDuration))}`
            : 'Closed',
          isOpen: service.isOpen,
          to: serviceLink(service, isAdmin),
        }
      })

    const pageHits = (isAdmin ? ADMIN_NAV : USER_NAV)
      .filter((item) => !search || matches(item.label, search))
      .map((item) => ({ id: item.to, kind: 'page', label: item.label, detail: 'Go to page', to: item.to }))

    return [...serviceHits, ...pageHits]
  }, [query, services, entriesFor, isAdmin])

  // Clamp while rendering rather than in an effect: as results shrink during
  // typing the highlight stays inside the list without an extra render pass.
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  function go(result) {
    onClose()
    navigate(result.to)
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      // Stepping from the clamped index, so the highlight never jumps after filtering.
      setActive((activeIndex + step + results.length) % results.length)
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      go(results[activeIndex])
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      onKeyDown={handleKeyDown}
      className="mx-auto mt-[12vh] w-[min(34rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0 text-ink-subtle" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${organization.name}`}
          aria-label="Search services and pages"
          maxLength={100}
          className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      {results.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <SearchX aria-hidden="true" className="mx-auto size-5 text-ink-subtle" strokeWidth={1.75} />
          <p className="mt-3 text-sm font-medium text-ink">No matches</p>
          <p className="mt-1 text-xs text-ink-muted">Try part of a service name.</p>
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1.5">
          {results.map((result, index) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onClick={() => go(result)}
                onMouseEnter={() => setActive(index)}
                aria-current={index === activeIndex || undefined}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === activeIndex ? 'bg-accent-soft' : ''
                }`}
              >
                {result.kind === 'service' ? (
                  <StatusDot className={result.isOpen ? 'bg-emerald-600' : 'bg-red-600'} pulse={result.isOpen} />
                ) : (
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-line-strong" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${index === activeIndex ? 'font-medium text-accent' : 'text-ink'}`}>
                    {result.label}
                  </span>
                  <span className="block truncate text-xs text-ink-subtle tabular-nums">{result.detail}</span>
                </span>
                {index === activeIndex && (
                  <CornerDownLeft aria-hidden="true" className="size-3.5 shrink-0 text-ink-subtle" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-line bg-sunken px-4 py-2.5 text-[11px] text-ink-subtle">
        <kbd className="font-sans font-medium">↑</kbd> <kbd className="font-sans font-medium">↓</kbd> to move ·{' '}
        <kbd className="font-sans font-medium">Enter</kbd> to open · <kbd className="font-sans font-medium">Esc</kbd> to
        close
      </p>
    </dialog>
  )
}
