import { Wrench, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { useAuth } from '../context/auth'
import { useNotifications } from '../context/notifications'
import { useOrganization } from '../context/organization'
import { useQueue } from '../context/queue'
import { users } from '../mocks/users'
import { ordinal } from '../utils/format'

const SAMPLE_VISITOR_ID = 'u-1'

// Demo controls. Only included when running `npm run dev`, never in a production
// build. Temporary: delete this folder and its line in Layout.jsx to remove it.
export function DevTools() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event) {
      if (!wrapperRef.current.contains(event.target)) setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="fixed bottom-4 left-4 z-30 md:left-16">
      {open && <DevPanel onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Developer tools"
        title="Developer tools"
        className={`grid size-9 place-items-center rounded-sm border shadow-card backdrop-blur-md transition-colors ${
          open ? 'border-line-strong bg-surface text-ink' : 'border-line bg-surface/85 text-ink-muted hover:text-ink'
        }`}
      >
        <Wrench className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

function DevPanel({ onClose }) {
  const navigate = useNavigate()
  const isAdminView = useLocation().pathname.startsWith('/admin')
  const { signInAs } = useAuth()
  const { organizations, organization, personLabel, setOrganizationId } = useOrganization()
  const { myEntry, entriesFor, getService, serveNext, serveEntry, moveEntry, resetOrganization } = useQueue()
  const { resetNotifications } = useNotifications()

  const adminOf = (organizationId) => users.find((u) => u.role === 'admin' && u.organizationId === organizationId)
  const active = myEntry?.status === 'served' ? null : myEntry
  const line = active ? entriesFor(active.serviceId) : []
  const service = active ? getService(active.serviceId) : null

  function switchOrganization(id) {
    setOrganizationId(id)
    if (isAdminView) signInAs(adminOf(id).id)
  }

  function switchView(view) {
    const admin = view === 'admin'
    signInAs(admin ? adminOf(organization.id).id : SAMPLE_VISITOR_ID)
    navigate(admin ? '/admin/dashboard' : '/app/status')
  }

  const setStatus = {
    waiting: () => moveEntry(active.id, line.length),
    almost_ready: () => moveEntry(active.id, Math.min(2, line.length)),
    served: () => serveEntry(active.id),
  }

  let lineSummary = 'Not in a line.'
  if (isAdminView) lineSummary = `Switch to the ${personLabel.toLowerCase()} view to control a place in line.`
  else if (active) lineSummary = `${ordinal(active.position)} of ${line.length} in ${service.name}.`
  else if (myEntry) lineSummary = 'Called to the desk. Reset the demo data to queue again.'

  function resetDemo() {
    resetOrganization(organization.id)
    resetNotifications(organization.id)
  }

  return (
    <div
      role="dialog"
      aria-label="Developer tools"
      className="absolute bottom-full left-0 mb-2 w-72 rounded-sm border border-line bg-surface shadow-[0_16px_40px_-16px_rgba(22,24,29,0.35)] motion-safe:animate-pop-in"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Developer tools</h2>
          <span className="rounded-xs border border-line px-1.5 py-px text-[10px] font-medium text-ink-subtle">dev only</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close developer tools"
          className="grid size-6 place-items-center rounded-sm text-ink-subtle hover:bg-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <Section title="Organization">
          <Segmented
            label="Organization"
            value={organization.id}
            onChange={switchOrganization}
            options={organizations.map((o) => ({ value: o.id, label: o.name.split(' ')[0] }))}
          />
        </Section>

        <Section title="View">
          <Segmented
            label="View"
            value={isAdminView ? 'admin' : 'visitor'}
            onChange={switchView}
            options={[
              { value: 'visitor', label: personLabel },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </Section>

        <Section title="Place in line">
          <p className="mb-2 text-xs text-ink-muted">{lineSummary}</p>
          <Segmented
            label="Set my status"
            value={active?.status}
            onChange={(status) => setStatus[status]()}
            options={[
              { value: 'waiting', label: 'Waiting', disabled: !active || line.length < 3 },
              { value: 'almost_ready', label: 'Almost ready', disabled: !active },
              { value: 'served', label: 'Served', disabled: !active },
            ]}
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            disabled={!active || active.position === 1}
            onClick={() => serveNext(active.serviceId)}
          >
            Serve the next person
          </Button>
        </Section>

        <Section title="Data">
          <Button variant="secondary" size="sm" className="w-full" onClick={resetDemo}>
            Reset {organization.name.split(' ')[0]} demo data
          </Button>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">{title}</h3>
      {children}
    </section>
  )
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-sm border border-line bg-sunken p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => value !== option.value && onChange(option.value)}
          className={`flex h-7 flex-1 items-center justify-center rounded-xs px-2 text-xs font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 ${
            value === option.value
              ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(22,24,29,0.08)] ring-1 ring-line'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
