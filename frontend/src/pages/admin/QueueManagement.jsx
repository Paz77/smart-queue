import { ArrowDown, ArrowUp, ChevronRight, Lock, Power, Settings2, UserCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge } from '../../components/PriorityBadge'
import { SelectField } from '../../components/SelectField'
import { StatusBadge } from '../../components/StatusBadge'
import { StatusDot } from '../../components/StatusDot'
import { useNotifications } from '../../context/notifications'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { estimateWait, formatRelative, formatTime, formatWait } from '../../utils/format'
import { STATUS_META } from '../../utils/status'

// Columns of the wide queue table: place, name, joined, status, estimated wait, actions.
const COLUMNS = 'grid grid-cols-[28px_minmax(0,1fr)_92px_108px_84px_144px] items-center gap-x-3'

export default function QueueManagement() {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const { services, entriesFor } = useQueue()
  const service = services.find((s) => s.id === serviceId)

  // An unknown id, or one from another organization, goes back to the list of services.
  if (serviceId && !service) return <Navigate to="/admin/queues" replace />

  const options = services.map((s) => ({
    value: s.id,
    label: `${s.name} · ${entriesFor(s.id).length} waiting${s.isOpen ? '' : ' (closed)'}`,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Queues"
        description="Call people up and keep the line in order."
        actions={
          <div className="w-[300px] max-w-full">
            <SelectField
              label="Service"
              name="service"
              placeholder="Choose a service"
              options={options}
              value={service?.id ?? ''}
              onChange={(event) => navigate(`/admin/queues/${event.target.value}`)}
            />
          </div>
        }
      />
      {service ? <ServiceQueue key={service.id} service={service} /> : <ServicePicker />}
    </>
  )
}

function ServicePicker() {
  const { services, entriesFor } = useQueue()

  if (services.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Settings2}
          title="No services yet"
          description="Add a service first, then run its line here."
          action={
            <Button as={Link} to="/admin/services">
              Add a service
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <section aria-labelledby="pick-title">
      <h2 id="pick-title" className="text-sm font-semibold text-ink">
        Choose a service
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">Pick one to see who’s waiting and call people up.</p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const waiting = entriesFor(service.id).length
          const status = STATUS_META[service.isOpen ? 'open' : 'closed']
          return (
            <li key={service.id}>
              <Link
                to={`/admin/queues/${service.id}`}
                className="block rounded-sm border border-line/80 bg-surface/97 px-5 py-4 shadow-card backdrop-blur-md transition-colors hover:border-line-strong hover:bg-surface"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-ink">{service.name}</span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-subtle" />
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  <StatusDot className={status.dot} pulse={service.isOpen} />
                  {status.label}
                </span>
                <span className="mt-4 flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl leading-8 font-semibold tracking-tight tabular-nums ${waiting ? 'text-ink' : 'text-ink-subtle'}`}
                  >
                    {waiting}
                  </span>
                  <span className="text-xs text-ink-muted">waiting</span>
                </span>
                <span className="block text-xs text-ink-subtle">About {service.expectedDuration} min each</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// One service's line: who is waiting, plus the controls to call, reorder and remove people.
function ServiceQueue({ service }) {
  const { entriesFor, serveNext, moveEntry, removeEntry, setServiceOpen, getLastCalled } = useQueue()
  const { organization } = useOrganization()
  const { addNotification } = useNotifications()
  const [removingId, setRemovingId] = useState(null)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const line = entriesFor(service.id)
  const removing = line.find((e) => e.id === removingId)
  const singular = organization.personSingular.toLowerCase()
  const plural = organization.personPlural.toLowerCase()
  const countPeople = (n) => `${n} ${n === 1 ? singular : plural}`

  function handleServeNext() {
    const next = line[1]
    const served = serveNext(service.id)
    if (!served) return
    addNotification({
      organizationId: service.organizationId,
      type: 'queue_update',
      title: `Now serving ${served.userName}`,
      message: next ? `${next.userName} is next in line.` : 'No one else is in line.',
    })
  }

  function confirmRemove() {
    removeEntry(removing.id)
    setRemovingId(null)
  }

  // Closing a line with people in it asks first, the same as on the overview.
  function handleToggleOpen() {
    if (service.isOpen && line.length > 0) setConfirmingClose(true)
    else setServiceOpen(service.id, !service.isOpen)
  }

  function confirmClose() {
    setServiceOpen(service.id, false)
    setConfirmingClose(false)
  }

  const rowProps = (entry, index) => ({
    entry,
    wait: formatWait(estimateWait(entry.position, service.expectedDuration)),
    isFirst: index === 0,
    isLast: index === line.length - 1,
    onMoveUp: () => moveEntry(entry.id, entry.position - 1),
    onMoveDown: () => moveEntry(entry.id, entry.position + 1),
    onRemove: () => setRemovingId(entry.id),
  })

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <Card className="min-w-0 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight text-ink">{service.name}</h2>
              <StatusBadge status={service.isOpen ? 'open' : 'closed'} live={service.isOpen} />
            </div>
            <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
              {line.length ? countPeople(line.length) : `No ${plural}`} waiting · about {service.expectedDuration} min each
            </p>
          </div>
          <Button onClick={handleServeNext} disabled={line.length === 0} className="w-full sm:w-auto">
            <UserCheck />
            Serve next
          </Button>
        </div>

        {!service.isOpen && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 sm:px-5">
            <p className="flex items-center gap-2 text-sm font-medium text-red-800">
              <Lock aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
              This queue is closed. No one new can join.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setServiceOpen(service.id, true)}>
              <Power />
              Open queue
            </Button>
          </div>
        )}

        {line.length === 0 ? (
          <EmptyState icon={Users} title="No one’s in line" description={`${organization.personPlural} who join will show up here.`} />
        ) : (
          <>
            {/* Narrow screens: one stacked card per person. */}
            <ol aria-label="People in line, front first" className="divide-y divide-line md:hidden">
              {line.map((entry, index) => (
                <QueueCard key={entry.id} {...rowProps(entry, index)} />
              ))}
            </ol>

            {/* Wider screens: one table row per person. */}
            <div className="hidden md:block">
              <div
                aria-hidden="true"
                className={`${COLUMNS} border-b border-line bg-sunken/70 px-5 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase`}
              >
                <span>#</span>
                <span>Name</span>
                <span>Joined</span>
                <span>Status</span>
                <span>Est. wait</span>
                <span className="text-right">Actions</span>
              </div>
              <ol aria-label="People in line, front first" className="divide-y divide-line">
                {line.map((entry, index) => (
                  <QueueRow key={entry.id} {...rowProps(entry, index)} />
                ))}
              </ol>
            </div>

            <p className="border-t border-line bg-sunken/80 px-4 py-3 text-xs text-ink-muted sm:px-5">
              Est. wait is place in line × {service.expectedDuration} min. The first two in line are marked almost ready.
            </p>
          </>
        )}
      </Card>

      <div className="flex min-w-0 flex-col gap-6">
        <NowServing called={getLastCalled(service.id)} singular={singular} />
        <AboutService service={service} onToggleOpen={handleToggleOpen} />
      </div>

      <Modal
        open={Boolean(removing)}
        onClose={() => setRemovingId(null)}
        title={removing && `Remove ${removing.userName}?`}
        description={
          removing && `They’ll lose their place in ${service.name}. Everyone behind them moves up one.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemovingId(null)}>
              Cancel
            </Button>
            <Button variant="danger-solid" onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      />

      <Modal
        open={confirmingClose}
        onClose={() => setConfirmingClose(false)}
        title={`Close ${service.name}?`}
        description={`The ${countPeople(line.length)} already in line ${line.length === 1 ? 'keeps' : 'keep'} their place. No one new can join.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingClose(false)}>
              Cancel
            </Button>
            <Button variant="danger-solid" onClick={confirmClose}>
              Close queue
            </Button>
          </>
        }
      />
    </div>
  )
}

function QueueRow({ entry, wait, ...actions }) {
  return (
    <li className={`${COLUMNS} px-5 py-3 transition-colors hover:bg-sunken`}>
      <span className="font-semibold text-ink-muted tabular-nums">
        <span className="sr-only">Place </span>
        {entry.position}
      </span>
      <p className="truncate font-medium text-ink">{entry.userName}</p>
      <p className="tabular-nums">
        <span className="sr-only">Joined </span>
        <span className="block text-ink">{formatTime(entry.joinedAt)}</span>
        <span className="block text-xs text-ink-subtle">{formatRelative(entry.joinedAt)}</span>
      </p>
      <div>
        <StatusBadge status={entry.status} />
      </div>
      <span className="text-ink tabular-nums">
        <span className="sr-only">Estimated wait </span>
        {wait}
      </span>
      <RowActions entry={entry} {...actions} />
    </li>
  )
}

function QueueCard({ entry, wait, ...actions }) {
  return (
    <li className="px-4 py-4 transition-colors hover:bg-sunken">
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 font-semibold text-ink-muted tabular-nums">
          <span className="sr-only">Place </span>
          {entry.position}
        </span>
        <p className="min-w-0 flex-1 truncate font-medium text-ink">{entry.userName}</p>
        <StatusBadge status={entry.status} />
      </div>
      <div className="mt-1.5 ml-[30px] flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-ink-muted tabular-nums">
        <span>
          Joined {formatTime(entry.joinedAt)} · {formatRelative(entry.joinedAt).toLowerCase()}
        </span>
        <span>
          Est. wait <span className="font-medium text-ink">{wait}</span>
        </span>
      </div>
      <RowActions entry={entry} {...actions} wide className="mt-3 ml-[30px]" />
    </li>
  )
}

// Move up / move down / remove. The narrow layout spreads them out with bigger touch targets.
function RowActions({ entry, isFirst, isLast, onMoveUp, onMoveDown, onRemove, wide = false, className = '' }) {
  const iconButton = wide ? 'size-9 px-0!' : 'size-8 px-0!'
  return (
    <div className={`flex items-center ${wide ? 'gap-2' : 'justify-end gap-1'} ${className}`}>
      <Button
        variant="secondary"
        size={wide ? 'md' : 'sm'}
        className={iconButton}
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label={`Move ${entry.userName} up`}
        title="Move up"
      >
        <ArrowUp />
      </Button>
      <Button
        variant="secondary"
        size={wide ? 'md' : 'sm'}
        className={iconButton}
        onClick={onMoveDown}
        disabled={isLast}
        aria-label={`Move ${entry.userName} down`}
        title="Move down"
      >
        <ArrowDown />
      </Button>
      <Button
        variant="danger"
        size={wide ? 'md' : 'sm'}
        className={wide ? 'ml-auto' : 'ml-1'}
        onClick={onRemove}
        aria-label={`Remove ${entry.userName}`}
      >
        Remove
      </Button>
    </div>
  )
}

function NowServing({ called, singular }) {
  const initials = called?.userName
    .split(' ')
    .map((part) => part[0])
    .join('')

  return (
    <Card>
      <CardHeader title="Now serving" />
      {called ? (
        <div aria-live="polite" className="flex items-center gap-3 px-5 py-4">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-sm bg-accent-soft text-[13px] font-semibold text-accent"
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{called.userName}</p>
            <p className="text-xs text-ink-muted tabular-nums">Called at {formatTime(called.calledAt)}</p>
          </div>
          <StatusBadge status="served" />
        </div>
      ) : (
        <div aria-live="polite" className="px-5 py-4">
          <p className="text-sm text-ink-muted">No one called yet.</p>
          <p className="mt-0.5 text-xs text-ink-subtle">Serve next calls the first {singular} in line.</p>
        </div>
      )}
    </Card>
  )
}

function AboutService({ service, onToggleOpen }) {
  const rows = [
    ['Expected duration', `${service.expectedDuration} min`],
    ['Priority', <PriorityBadge key="priority" priority={service.priority} />],
    [
      'Queue',
      <span key="queue" className="inline-flex items-center gap-2">
        <StatusDot className={service.isOpen ? 'bg-emerald-600' : 'bg-red-600'} pulse={service.isOpen} />
        {service.isOpen ? 'Open' : 'Closed'}
      </span>,
    ],
  ]

  return (
    <Card>
      <CardHeader title="About this service" />
      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-muted">{service.description}</p>
        <dl className="mt-4 divide-y divide-line border-t border-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-sunken/80 px-5 py-3">
        <Link
          to={`/admin/services?edit=${service.id}`}
          className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
        >
          Edit service
        </Link>
        <Button variant="secondary" size="sm" onClick={onToggleOpen}>
          <Power />
          {service.isOpen ? 'Close queue' : 'Open queue'}
        </Button>
      </div>
    </Card>
  )
}
