import { Pencil, Plus, Settings2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge } from '../../components/PriorityBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { estimateWait, formatWait } from '../../utils/format'

const PRIORITIES = ['high', 'medium', 'low']

// Columns of the wide services table: service, priority, duration, status, waiting, wait, actions.
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_96px_72px_92px_64px_140px_224px] items-center gap-x-4'

const manageLink = (service) => `/admin/queues/${service.id}`
const editLink = (service) => `/admin/services?edit=${service.id}`

export default function AdminDashboard() {
  const { services, entriesFor, setServiceOpen } = useQueue()
  const { organization } = useOrganization()
  const [closingId, setClosingId] = useState(null)

  const people = organization.personPlural.toLowerCase()
  const countPeople = (n) => `${n} ${n === 1 ? organization.personSingular.toLowerCase() : people}`

  const newServiceButton = (
    <Button as={Link} to="/admin/services">
      <Plus />
      New service
    </Button>
  )

  const header = (
    <PageHeader
      eyebrow="Administration"
      title="Overview"
      description="Your services and how busy they are right now."
      actions={newServiceButton}
    />
  )

  if (services.length === 0) {
    return (
      <>
        {header}
        <Card>
          <CardHeader title="Services" description="Nothing to show yet." />
          <EmptyState
            icon={Settings2}
            title="Add your first service"
            description={`A service is a desk ${people} line up for. Add one to open its queue.`}
            action={newServiceButton}
          />
        </Card>
      </>
    )
  }

  const rows = services.map((service) => {
    const waiting = entriesFor(service.id).length
    return {
      ...service,
      waiting,
      // What someone joining right now would wait: everyone ahead of them, plus their own turn.
      waitIfJoining: service.isOpen ? formatWait(estimateWait(waiting + 1, service.expectedDuration)) : '—',
    }
  })

  const openCount = rows.filter((s) => s.isOpen).length
  const totalWaiting = rows.reduce((sum, s) => sum + s.waiting, 0)
  const busyQueues = rows.filter((s) => s.waiting > 0).length
  const busiest = rows.reduce((top, s) => (s.waiting > (top?.waiting ?? 0) ? s : top), null)
  const priorityMix = PRIORITIES.map((p) => `${rows.filter((s) => s.priority === p).length} ${p}`).join(' · ')

  let waitingHint = 'No one in line'
  if (busyQueues === 1) waitingHint = 'In 1 queue'
  else if (busyQueues > 1) waitingHint = `Across ${busyQueues} queues`

  const closing = rows.find((s) => s.id === closingId)

  // Closing a line with people in it asks first; everything else happens right away.
  function handleToggle(service) {
    if (service.isOpen && service.waiting > 0) setClosingId(service.id)
    else setServiceOpen(service.id, !service.isOpen)
  }

  function confirmClose() {
    setServiceOpen(closing.id, false)
    setClosingId(null)
  }

  return (
    <>
      {header}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile label="Services" value={rows.length} hint={priorityMix} />
        <StatTile
          label="Open queues"
          value={
            <>
              {openCount}
              <span className="ml-1.5 text-sm font-normal tracking-normal text-ink-subtle">of {rows.length}</span>
            </>
          }
          hint={
            <span aria-hidden="true" className="mt-3.5 flex gap-[3px]">
              {rows.map((s) => (
                <span key={s.id} className={`h-1 flex-1 rounded-xs ${s.isOpen ? 'bg-accent' : 'bg-line'}`} />
              ))}
            </span>
          }
        />
        <StatTile label={`${organization.personPlural} waiting`} value={totalWaiting} hint={waitingHint} />
        <StatTile
          label="Busiest"
          value={<span className="block truncate text-base sm:text-lg">{busiest?.name ?? '—'}</span>}
          hint={busiest ? `${busiest.waiting} waiting` : 'No one in line'}
        />
      </div>

      <Card>
        <CardHeader title="Services" description={`Switch a queue off to stop new ${people} from joining.`} />

        {/* Narrow screens: one stacked card per service. */}
        <ul className="focus-list divide-y divide-line xl:hidden">
          {rows.map((service) => (
            <li key={service.id} className={`px-4 py-4 sm:px-5 ${service.isOpen ? '' : 'bg-canvas/60'}`}>
              <div className="flex items-start justify-between gap-3">
                <ServiceName service={service} wrap />
                <QueueSwitch service={service} onToggle={handleToggle} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge status={service.isOpen ? 'open' : 'closed'} live={service.isOpen} />
                <PriorityBadge priority={service.priority} />
              </div>
              <dl className="mt-3.5 grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-6 border-t border-line pt-3">
                <Detail label="Duration" muted={!service.isOpen}>{service.expectedDuration} min</Detail>
                <Detail label="Waiting" muted={service.waiting === 0}>{service.waiting}</Detail>
                <Detail label="Wait if you join now" muted={!service.isOpen}>{service.waitIfJoining}</Detail>
              </dl>
              <div className="mt-3.5 flex gap-2">
                <Button as={Link} to={manageLink(service)} variant="secondary" className="flex-1 sm:flex-none">
                  <Users />
                  Manage queue
                </Button>
                <Button as={Link} to={editLink(service)} variant="secondary">
                  <Pencil />
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {/* Wide screens: one row per service. */}
        <div className="hidden xl:block">
          <div
            aria-hidden="true"
            className={`${COLUMNS} border-b border-line bg-sunken/70 px-5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase`}
          >
            <span>Service</span>
            <span>Priority</span>
            <span>Duration</span>
            <span>Status</span>
            <span>Waiting</span>
            <span>Wait if you join now</span>
            <span className="text-right">Open / close</span>
          </div>
          <ul className="focus-list divide-y divide-line">
            {rows.map((service) => (
              <li key={service.id} className={`${COLUMNS} px-5 py-3 ${service.isOpen ? '' : 'bg-canvas/60'}`}>
                <ServiceName service={service} />
                <div>
                  <PriorityBadge priority={service.priority} />
                </div>
                <span className={`tabular-nums ${service.isOpen ? 'text-ink' : 'text-ink-subtle'}`}>
                  {service.expectedDuration} min
                </span>
                <div>
                  <StatusBadge status={service.isOpen ? 'open' : 'closed'} live={service.isOpen} />
                </div>
                <span className={`font-medium tabular-nums ${service.waiting ? 'text-ink' : 'text-ink-subtle'}`}>
                  <span className="sr-only">Waiting: </span>
                  {service.waiting}
                </span>
                <span className={`tabular-nums ${service.isOpen ? 'text-ink' : 'text-ink-subtle'}`}>
                  <span className="sr-only">Wait if you join now: </span>
                  {service.waitIfJoining}
                </span>
                <div className="flex items-center justify-end gap-2">
                  <QueueSwitch service={service} onToggle={handleToggle} />
                  <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
                  <Button as={Link} to={manageLink(service)} variant="secondary" size="sm">
                    <Users />
                    Manage queue
                  </Button>
                  <Button
                    as={Link}
                    to={editLink(service)}
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${service.name}`}
                    title={`Edit ${service.name}`}
                    className="px-2"
                  >
                    <Pencil />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Modal
        open={Boolean(closing)}
        onClose={() => setClosingId(null)}
        title={closing && `Close ${closing.name}?`}
        description={
          closing &&
          `The ${countPeople(closing.waiting)} already in line ${closing.waiting === 1 ? 'keeps' : 'keep'} their place. No one new can join.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosingId(null)}>
              Cancel
            </Button>
            <Button variant="danger-solid" onClick={confirmClose}>
              Close queue
            </Button>
          </>
        }
      />
    </>
  )
}

function StatTile({ label, value, hint }) {
  return (
    <Card className="px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
      <p className="mt-2 text-2xl leading-8 font-semibold tracking-tight text-ink tabular-nums sm:text-[28px]">{value}</p>
      {typeof hint === 'string' ? <p className="mt-2 text-xs text-ink-muted tabular-nums">{hint}</p> : hint}
    </Card>
  )
}

function ServiceName({ service, wrap = false }) {
  return (
    <div className="min-w-0">
      <p className={`font-medium ${service.isOpen ? 'text-ink' : 'text-ink-muted'}`}>{service.name}</p>
      <p className={`mt-0.5 text-xs text-ink-subtle ${wrap ? '' : 'truncate'}`}>{service.description}</p>
    </div>
  )
}

// A square on/off switch: on means the queue is open to new people.
function QueueSwitch({ service, onToggle }) {
  const on = service.isOpen
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${service.name} queue`}
      title={on ? 'Close queue' : 'Open queue'}
      onClick={() => onToggle(service)}
      className={`relative h-5 w-9 shrink-0 rounded-sm border transition-colors ${
        on ? 'border-accent bg-accent hover:border-accent-hover hover:bg-accent-hover' : 'border-line-strong bg-surface hover:bg-sunken'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-3.5 rounded-xs transition-transform duration-150 ease-out motion-reduce:transition-none ${
          on ? 'translate-x-4 bg-white' : 'bg-ink-subtle'
        }`}
      />
    </button>
  )
}

function Detail({ label, muted = false, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-subtle uppercase">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${muted ? 'text-ink-subtle' : 'text-ink'}`}>{children}</dd>
    </div>
  )
}
