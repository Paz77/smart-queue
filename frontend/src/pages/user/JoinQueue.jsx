import { ArrowRight, Check, ListPlus, ListX, Lock, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { estimateWait, formatTime, formatWait, ordinal } from '../../utils/format'
import { required } from '../../utils/validation'

const SPOT_LIMIT = 8

//current time, refreshed every 30 seconds so that time-of-day estimates stay current
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

//The time of day your turn should come if you waited this many minutes from now
function turnAround(now, minutes) {
  return formatTime(new Date(now + minutes * 60_000).toISOString())
}

export default function JoinQueue() {
  const { services, entriesFor, myEntry, joinQueue, leaveQueue } = useQueue()
  const { organization } = useOrganization()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const now = useNow()

  const people = organization.personPlural?.toLowerCase() ?? 'people'
  //A visit that was just served is over, so only a place you are still waiting in counts
  const activeEntry = myEntry && myEntry.status !== 'served' ? myEntry : null

  const all = services.map((service) => {
    const waiting = entriesFor(service.id).length
    const isMine = activeEntry?.serviceId === service.id
    //Your real place if you are in this line, otherwise the place you would get by joining now
    const spot = isMine ? activeEntry.position : waiting + 1
    const wait = estimateWait(spot, service.expectedDuration)
    return { ...service, waiting, isMine, spot, wait, turnAt: turnAround(now, wait) }
  })
  //Open services from shortest to longest wait, then closed ones
  const rows = [
    ...all.filter((service) => service.isOpen).sort((a, b) => a.wait - b.wait),
    ...all.filter((service) => !service.isOpen),
  ]

  const mine = rows.find((service) => service.isMine) ?? null
  //?service=<id> picks a service, so the dashboard tiles can link straight to it; otherwise your own line is shown
  const selected = rows.find((service) => service.id === searchParams.get('service')) ?? mine
  //You can only hold one place at a time, and closed lines take no one new
  const canJoin = Boolean(selected?.isOpen) && !activeEntry
  const join = { selected, mine, canJoin, error, people }

  function pick(serviceId) {
    setSearchParams({ service: serviceId }, { replace: true })
    setError('')
  }

  //Give up your place; if no other line is picked, keep this one picked so joining again is one click
  function confirmLeave() {
    setLeaving(false)
    if (!searchParams.get('service')) setSearchParams({ service: mine.id }, { replace: true })
    leaveQueue()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const problem = required(selected?.id, 'Service')
    if (problem) {
      setError(problem)
      return
    }
    if (!canJoin) return
    if (!joinQueue(selected.id)) setError('That line could not be joined. Please try again.')
  }

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title="Join a queue"
        description="Pick a service to see how long you would wait, then take your place in line."
      />

      <div aria-live="polite">{mine && <InLineCard service={mine} onLeave={() => setLeaving(true)} />}</div>

      {rows.length === 0 ? (
        <NoServices organizationName={organization.name} />
      ) : (
        <form noValidate onSubmit={handleSubmit}>
          <WaitComparison rows={rows} selected={selected} onPick={pick} join={join} />
        </form>
      )}

      {mine && (
        <LeaveConfirm service={mine} open={leaving} onStay={() => setLeaving(false)} onLeave={confirmLeave} />
      )}
    </>
  )
}

//Shown in place of the bars when the organization has no services yet
function NoServices({ organizationName }) {
  return (
    <Card>
      <EmptyState
        icon={ListX}
        title="No services to join yet"
        description={`${organizationName} hasn't opened any lines. Check back soon.`}
        action={
          <Button variant="secondary" as={Link} to="/app/dashboard">
            Back to dashboard
          </Button>
        }
      />
    </Card>
  )
}

//The "are you sure?" box before giving up your place
function LeaveConfirm({ service, open, onStay, onLeave }) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      title={`Leave ${service.name}?`}
      description={`You're ${ordinal(service.spot)} in line. If you leave, everyone behind you moves up, and joining again puts you at the back of the line.`}
      footer={
        <>
          <Button variant="secondary" onClick={onStay}>
            Keep my place
          </Button>
          <Button variant="danger-solid" onClick={onLeave}>
            <LogOut />
            Leave line
          </Button>
        </>
      }
    />
  )
}

//Shown once you hold a place in a line, since you can only be in one at a time
function InLineCard({ service, onLeave }) {
  return (
    <Card className="mb-6 flex flex-wrap items-center gap-4 px-6 py-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-accent/20 bg-accent-soft text-accent">
        <Check className="size-4.5" strokeWidth={2} />
      </div>
      <div className="min-w-48 flex-1">
        <h2 className="text-sm font-semibold text-ink">You're in line for {service.name}</h2>
        <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
          {ordinal(service.spot)} in line · about {formatWait(service.wait)} left · your turn around ~{service.turnAt}
        </p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <Button variant="danger" size="sm" onClick={onLeave} className="flex-1 sm:flex-none">
          <LogOut />
          Leave line
        </Button>
        <Button variant="secondary" size="sm" as={Link} to="/app/status" className="flex-1 sm:flex-none">
          View queue status
          <ArrowRight />
        </Button>
      </div>
    </Card>
  )
}

//Every line's wait as a bar, shortest first; click one to pick it, then join from the card below
function WaitComparison({ rows, selected, onPick, join }) {
  const longest = Math.max(1, ...rows.filter((service) => service.isOpen).map((service) => service.wait))
  const showWait = selected && (selected.isOpen || selected.isMine)
  const allClosed = rows.every((service) => !service.isOpen)

  return (
    <>
      <Card className="p-3">
        <p className="px-3 pt-1 pb-3 text-xs text-ink-muted">
          {allClosed
            ? 'All lines are closed right now, so no one new can join. Check back soon.'
            : 'Choose Service to join its queue. Each bar is the estimated wait time if you joined now.'}
        </p>
        <ul className="divide-y divide-line-strong">
          {rows.map((service) => (
            <li key={service.id} className="py-1">
              <WaitBar service={service} longest={longest} picked={service.id === selected?.id} onPick={onPick} />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <div className="px-6 py-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{selected.name}</h2>
                <ServiceTag service={selected} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{selected.description}</p>
              <div className="mt-4">
                {showWait ? <WaitSummary service={selected} /> : <ClosedNote service={selected} people={join.people} />}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Pick a line above to see your spot and when your turn should come.</p>
          )}
        </div>
        <JoinBar join={join} className="border-t border-line bg-sunken px-6 py-4" />
      </Card>
    </>
  )
}

//One row: the name, a bar as long as the wait, and the wait itself
function WaitBar({ service, longest, picked, onPick }) {
  const closed = !service.isOpen && !service.isMine
  const width = Math.min(100, Math.max(4, Math.round((service.wait / longest) * 100)))

  let tone = 'hover:bg-sunken'
  if (picked) tone = 'bg-accent-soft'
  else if (closed) tone = 'cursor-not-allowed'

  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={closed}
      onClick={() => onPick(service.id)}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 rounded-sm px-3 py-2.5 text-left transition-colors sm:grid-cols-[11rem_minmax(0,1fr)_7rem] ${tone}`}
    >
      <span
        className={`col-start-1 row-start-1 truncate text-sm font-medium ${picked ? 'text-accent' : closed ? 'text-ink-subtle' : 'text-ink'}`}
      >
        {service.name}
      </span>
      <span
        aria-hidden="true"
        className={`relative col-span-2 row-start-2 h-2.5 rounded-full sm:col-span-1 sm:col-start-2 sm:row-start-1 ${
          closed ? 'border border-dashed border-line-strong' : 'bg-line'
        }`}
      >
        {!closed && (
          <span
            className={`absolute inset-y-0 left-0 rounded-full ${picked ? 'bg-accent' : 'bg-accent/40'}`}
            style={{ width: `${width}%` }}
          />
        )}
      </span>
      <span className="col-start-2 row-start-1 justify-self-end text-xs text-ink-muted tabular-nums sm:col-start-3">
        {closed ? <ClosedTag /> : service.isMine ? `You · ~${formatWait(service.wait)}` : `~${formatWait(service.wait)}`}
      </span>
    </button>
  )
}

//Big wait, your spot, the line of squares and when your turn should come
function WaitSummary({ service }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
        ~{formatWait(service.wait)}
        <span className="ml-2 text-base font-normal tracking-normal text-ink-muted">
          · {service.isMine ? "you're" : "you'd be"} {ordinal(service.spot)} in line
        </span>
      </p>
      <div className="mt-3">
        <SpotRow ahead={service.spot - 1} />
      </div>
      <p className="mt-3 text-xs text-ink-muted tabular-nums">
        Your turn around <span className="font-medium text-ink">~{service.turnAt}</span> · About{' '}
        {service.expectedDuration} min per person
      </p>
    </div>
  )
}

//The people ahead of you as grey squares, then you at the end
function SpotRow({ ahead }) {
  const shown = Math.min(ahead, SPOT_LIMIT)
  const label = ahead === 0 ? 'No one ahead of you' : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead of you`

  return (
    <div role="img" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">Desk</span>
      {Array.from({ length: shown }, (_, slot) => (
        <span key={slot} className="size-5 rounded-xs bg-line-strong" />
      ))}
      {ahead > SPOT_LIMIT && <span className="text-xs text-ink-subtle tabular-nums">+{ahead - SPOT_LIMIT}</span>}
      <span className="grid h-5 place-items-center rounded-xs border-2 border-accent px-1.5 text-[10px] font-semibold uppercase text-accent">
        You
      </span>
    </div>
  )
}

function ClosedNote({ service, people }) {
  const still = service.waiting === 0 ? 'No one is in line.' : `${service.waiting} still in line keep their place.`
  return (
    <p className="text-sm text-ink-muted">
      This line is closed, so no new {people} can join right now. {still}
    </p>
  )
}

//The note and Join button at the bottom of the card
function JoinBar({ join, className = '' }) {
  const { selected, mine, canJoin, error } = join
  const inThisLine = Boolean(selected?.isMine)

  let note = 'You can leave the line at any time.'
  if (inThisLine) {
    note = 'This is your line. Your place is saved. Use Leave line at the top to give it up.'
  } else if (!selected) {
    note = 'Pick a service to see your wait.'
  } else if (!selected.isOpen) {
    note = `${selected.name} is closed, so no one new can join right now.`
  } else if (mine) {
    note = `You can only hold one place at a time. Leave ${mine.name} first to join ${selected.name}.`
  }

  let label = 'Join line'
  if (inThisLine) label = 'Already in this line'
  else if (canJoin) label = `Join ${selected.name}`

  return (
    <div className={className}>
      {error && (
        <p role="alert" className="mb-3 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-48 flex-1 text-xs leading-relaxed text-ink-muted">{note}</p>
        <Button type="submit" disabled={!canJoin} className="w-full sm:w-auto">
          {inThisLine ? <Check /> : <ListPlus />}
          {label}
        </Button>
      </div>
    </div>
  )
}

function ServiceTag({ service }) {
  if (service.isMine) return <MineTag />
  return service.isOpen ? <OpenTag /> : <ClosedTag />
}

function OpenTag() {
  return (
    <span className="shrink-0 rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
      Open
    </span>
  )
}

function MineTag() {
  return (
    <span className="shrink-0 rounded-sm border border-accent/20 bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
      You're in this line
    </span>
  )
}

function ClosedTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
      <Lock aria-hidden="true" className="size-3" strokeWidth={2} />
      Closed
    </span>
  )
}
