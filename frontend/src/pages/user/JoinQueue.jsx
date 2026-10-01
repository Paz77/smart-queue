import { ArrowRight, Check, CircleAlert, ListPlus, LogOut, SearchX, Timer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge } from '../../components/PriorityBadge'
import { SearchInput } from '../../components/SearchInput'
import { StatusBadge } from '../../components/StatusBadge'
import { StatusDot } from '../../components/StatusDot'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { capitalize, estimateWait, formatWait, ordinal } from '../../utils/format'

export default function JoinQueue() {
  const { services, entriesFor, myEntry, getService, joinQueue, leaveQueue } = useQueue()
  const { organization } = useOrganization()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [query, setQuery] = useState('')

  // ?service=<id> preselects a service, so the dashboard's Join buttons can link straight here.
  const selectedId = searchParams.get('service')
  const selected = services.find((service) => service.id === selectedId) ?? null

  // A just-served entry does not hold a place in line, so it does not block joining again.
  const activeEntry = myEntry && myEntry.status !== 'served' ? myEntry : null
  const activeService = activeEntry ? getService(activeEntry.serviceId) : null

  const rows = services.map((service) => {
    const waiting = entriesFor(service.id).length
    return {
      ...service,
      waiting,
      // Everyone already in line, plus this person's own turn.
      waitIfJoining: estimateWait(waiting + 1, service.expectedDuration),
    }
  })

  const selectedRow = rows.find((service) => service.id === selected?.id) ?? null

  // Filtering only hides rows from the list; a service picked before searching
  // stays selected, so the estimate panel does not empty out as you type.
  const search = query.trim().toLowerCase()
  const visible = rows.filter(
    (service) =>
      !search ||
      service.name.toLowerCase().includes(search) ||
      service.description.toLowerCase().includes(search),
  )

  function select(serviceId) {
    setSearchParams({ service: serviceId }, { replace: true })
    setError('')
  }

  function handleSubmit(event) {
    event.preventDefault()

    // The submit button already covers both of these; they are here so the form
    // cannot be submitted into a bad state by any other route (Enter, a stale page).
    if (!selectedRow) {
      setError('Choose a service before joining.')
      return
    }
    if (!selectedRow.isOpen) {
      setError(`${selectedRow.name} is closed and is not taking new ${organization.personPlural.toLowerCase()}.`)
      return
    }

    if (!joinQueue(selectedRow.id)) {
      setError('That queue could not be joined. Refresh and try again.')
      return
    }
    navigate('/app/status')
  }

  const header = (
    <PageHeader
      eyebrow="Your queue"
      title="Join a queue"
      description={`Pick a service at ${organization.name} to see how long the wait is, then take a place in line.`}
    />
  )

  if (services.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Timer}
            title="No services yet"
            description={`${organization.name} has not published any services. Check back soon.`}
          />
        </Card>
      </>
    )
  }

  return (
    <>
      {header}

      {activeEntry && (
        <ActiveQueueNotice
          entry={activeEntry}
          service={activeService}
          lineLength={entriesFor(activeEntry.serviceId).length}
          onLeave={() => setConfirmingLeave(true)}
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form noValidate onSubmit={handleSubmit}>
          <Card>
            <CardHeader
              title="Choose a service"
              description={
                activeEntry
                  ? 'Leave your current queue before joining another one.'
                  : `${rows.filter((s) => s.isOpen).length} of ${rows.length} open right now`
              }
              action={
                rows.length > 3 ? (
                  <SearchInput
                    label="Search by service name"
                    placeholder="Search services"
                    value={query}
                    onChange={setQuery}
                    className="w-44"
                  />
                ) : undefined
              }
            />

            <fieldset disabled={Boolean(activeEntry)} className="group">
              <legend className="sr-only">Service</legend>
              {visible.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No services match"
                  description="Try a different search term."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-line group-disabled:opacity-60">
                  {visible.map((service) => (
                    <ServiceOption
                      key={service.id}
                      service={service}
                      checked={service.id === selectedRow?.id}
                      onSelect={() => select(service.id)}
                    />
                  ))}
                </ul>
              )}
            </fieldset>

            <div className="border-t border-line bg-sunken/80 px-5 py-4">
              {error && (
                <p role="alert" className="mb-3 flex items-start gap-2 text-xs text-red-700">
                  <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                  {error}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-48 flex-1 text-xs leading-relaxed text-ink-muted">
                  {activeEntry
                    ? `You are already ${ordinal(activeEntry.position)} in line for ${activeService.name}.`
                    : selectedRow
                      ? `You will be number ${selectedRow.waiting + 1} in line for ${selectedRow.name}.`
                      : 'Select a service to continue.'}
                </p>
                <Button
                  type="submit"
                  disabled={Boolean(activeEntry) || !selectedRow?.isOpen}
                  className="w-full sm:w-auto"
                >
                  <ListPlus />
                  Join queue
                </Button>
              </div>
            </div>
          </Card>
        </form>

        <ServiceDetails service={selectedRow} people={organization.personPlural} />
      </div>

      <Modal
        open={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        title="Leave this queue?"
        description={
          activeEntry &&
          `You will give up your place (${ordinal(activeEntry.position)} in line) for ${activeService.name}. If you join again, you will start at the back of the line.`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmingLeave(false)}>
              Stay in line
            </Button>
            <Button
              variant="danger-solid"
              onClick={() => {
                leaveQueue()
                setConfirmingLeave(false)
              }}
            >
              Leave queue
            </Button>
          </>
        }
      />
    </>
  )
}

// One selectable row. Closed queues stay visible but cannot be picked.
function ServiceOption({ service, checked, onSelect }) {
  const disabled = !service.isOpen

  return (
    <li className={disabled ? 'bg-canvas/60' : ''}>
      <label
        className={`relative flex cursor-pointer items-start gap-3 px-5 py-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent ${
          checked ? 'bg-accent-soft' : 'hover:bg-sunken'
        } ${disabled ? 'cursor-not-allowed hover:bg-transparent' : ''}`}
      >
        {checked && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] bg-accent" />}

        <input
          type="radio"
          name="service"
          value={service.id}
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
          className="sr-only"
        />

        {/* Square radio, drawn to match the app's other controls. */}
        <span
          aria-hidden="true"
          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-xs border ${
            checked ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'
          }`}
        >
          {checked && <Check className="size-3" strokeWidth={3} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-medium ${disabled ? 'text-ink-muted' : checked ? 'text-accent' : 'text-ink'}`}>
              {service.name}
            </span>
            {disabled && <StatusBadge status="closed" />}
          </span>
          <span className="mt-0.5 block text-xs text-ink-subtle">{service.description}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            <PriorityBadge priority={service.priority} />
            <span className="tabular-nums">{service.waiting} in line</span>
            <span className="tabular-nums">
              {disabled ? 'Not taking new arrivals' : `~${formatWait(service.waitIfJoining)} wait`}
            </span>
          </span>
        </span>
      </label>
    </li>
  )
}

// The estimate panel beside the list: what joining the selected service means.
function ServiceDetails({ service, people }) {
  if (!service) {
    return (
      <Card>
        <CardHeader title="Estimated wait" />
        <EmptyState
          icon={Timer}
          title="Nothing selected"
          description="Choose a service to see its estimated wait and how many people are ahead of you."
        />
      </Card>
    )
  }

  const rows = [
    ['Time per person', `${service.expectedDuration} min`],
    [`${people} in line`, service.waiting],
    ['Your position if you join', ordinal(service.waiting + 1)],
    ['Priority', capitalize(service.priority)],
  ]

  return (
    <Card>
      <CardHeader title="Estimated wait" description={service.name} />

      <div className="flex flex-col items-center border-b border-line px-6 py-7 text-center">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">If you join now</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-ink tabular-nums">
          {service.isOpen ? formatWait(service.waitIfJoining) : '—'}
        </p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-muted">
          {service.isOpen
            ? `Based on ${service.waiting} ahead of you at about ${service.expectedDuration} min each. The estimate updates as the line moves.`
            : 'This queue is closed, so no new estimate is available.'}
        </p>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-ink-muted">{service.description}</p>
        <dl className="mt-4 divide-y divide-line border-t border-line">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium text-ink tabular-nums">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <dt className="text-ink-muted">Queue</dt>
            <dd className="inline-flex items-center gap-2 font-medium text-ink">
              <StatusDot className={service.isOpen ? 'bg-emerald-600' : 'bg-red-600'} pulse={service.isOpen} />
              {service.isOpen ? 'Open' : 'Closed'}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}

// Shown when the person is already waiting somewhere: they can only hold one place at a time.
function ActiveQueueNotice({ entry, service, lineLength, onLeave }) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">You are already in line for {service.name}</p>
            <StatusBadge status={entry.status} live />
          </div>
          <p className="mt-1 text-xs text-ink-muted tabular-nums">
            {ordinal(entry.position)} of {lineLength} · about{' '}
            {formatWait(estimateWait(entry.position, service.expectedDuration))} left. You can hold one place at a time.
          </p>
        </div>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="danger" size="sm" onClick={onLeave}>
            <LogOut />
            Leave queue
          </Button>
          <Button as={Link} to="/app/status" variant="secondary" size="sm">
            View status
            <ArrowRight />
          </Button>
        </div>
      </div>
    </Card>
  )
}
