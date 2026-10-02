import { ArrowRight, Check, ListPlus, Lock, Timer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { useAuth } from '../../context/auth'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { estimateWait, formatTime, formatWait, ordinal } from '../../utils/format'

const STATUS_HINT = {
  waiting: 'We will notify you as you move up in the line.',
  almost_ready: 'You are one of the next two. Start heading to the desk.',
  served: 'This visit has been added to your history.',
}

//current time, refreshed every 30 seconds so that time-of-day estimates stay current
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function Dashboard() {
  const { currentUser } = useAuth()
  const { organization } = useOrganization()
  const firstName = currentUser?.name.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
        description="Where you are in line, what you can join, and your latest updates."
      />

      <div className="space-y-6">
        <CurrentQueue />
        <ActiveServices />
      </div>
    </>
  )
}

//Your place in line right now: waiting, just called to the desk, or not in a queue
function CurrentQueue() {
  const { myEntry, getService, entriesFor } = useQueue()
  const now = useNow()

  if (!myEntry) {
    return (
      <Card className="flex flex-wrap items-center gap-4 px-6 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-sunken text-ink-muted">
          <Timer className="size-4.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-48 flex-1">
          <h2 className="text-sm font-semibold text-ink">You're not in a line right now</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Pick a service to get a spot. Your place and wait time will show up here.</p>
        </div>
        <Button as={Link} to="/app/join" size="sm" className="w-full sm:w-auto">
          <ListPlus />
          Join a queue
        </Button>
      </Card>
    )
  }

  const service = getService(myEntry.serviceId)
  const isServed = myEntry.status === 'served'
  const lineLength = entriesFor(myEntry.serviceId).length
  const wait = estimateWait(myEntry.position, service.expectedDuration)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">Your current queue</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{service.name}</h2>
        </div>
        <StatusBadge status={myEntry.status} live />
      </div>

      {isServed ? (
        <div className="flex items-start gap-4 px-6 py-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Check className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">It is your turn</h3>
            <p className="mt-0.5 text-sm text-ink-muted">
              {service.name} called you at {formatTime(myEntry.servedAt)}. Please go to the service desk.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">
          <p aria-live="polite" className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
            {ordinal(myEntry.position)} in line
            <span className="ml-2 text-base font-normal tracking-normal text-ink-muted">
              · about {formatWait(wait)} left
            </span>
          </p>
          <WaitTimeline joinedAt={myEntry.joinedAt} waitMinutes={wait} now={now} />
          <p className="mt-4 text-xs text-ink-muted tabular-nums">
            {peopleAhead(myEntry.position - 1)} · {lineLength} in line total
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-6 py-4">
        <p className="min-w-48 flex-1 text-xs leading-relaxed text-ink-muted">{STATUS_HINT[myEntry.status]}</p>
        <Button variant="secondary" size="sm" as={Link} to="/app/status" className="w-full sm:w-auto">
          View queue status
          <ArrowRight />
        </Button>
      </div>
    </Card>
  )
}

const METER_SLOTS = 8

//Every service here: open ones from shortest to longest wait, then closed ones
function ActiveServices() {
  const { services, entriesFor, myEntry } = useQueue()
  const { organization } = useOrganization()

  const inLine = Boolean(myEntry) && myEntry.status !== 'served'
  const people = organization.personPlural?.toLowerCase() ?? 'people'

  const rows = services.map((service) => {
    const waiting = entriesFor(service.id).length
    const isMine = inLine && myEntry.serviceId === service.id
    return {
      ...service,
      waiting,
      isMine,
      position: isMine ? myEntry.position : null,
      //Your own wait if you are in this line, otherwise the wait if you joined now
      wait: estimateWait(isMine ? myEntry.position : waiting + 1, service.expectedDuration),
      to: isMine ? '/app/status' : `/app/join?service=${service.id}`,
      //You can only be in one line at a time, so other lines are just for looking
      action: isMine ? 'View status' : inLine ? 'See wait' : 'Join',
    }
  })

  const open = rows.filter((service) => service.isOpen).sort((a, b) => a.wait - b.wait)
  const closed = rows.filter((service) => !service.isOpen)
  const shortestId = open.find((service) => !service.isMine)?.id

  return (
    <section aria-labelledby="services-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="services-heading" className="text-sm font-semibold text-ink">
          Services
        </h2>
        <p className="text-xs text-ink-muted tabular-nums">
          {open.length} of {rows.length} open to new {people}
        </p>
      </div>

      {rows.length === 0 ? (
        <QuietCard text="No services have been added here yet. Check back soon." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {open.map((service) => (
            <li key={service.id}>
              <OpenTile service={service} isShortest={service.id === shortestId} />
            </li>
          ))}
          {closed.map((service) => (
            <li key={service.id}>
              <ClosedTile service={service} people={people} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QuietCard({ text }) {
  return (
    <Card className="flex items-center gap-4 px-6 py-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-sm border border-line bg-sunken text-ink-muted">
        <Timer className="size-4.5" strokeWidth={1.75} />
      </div>
      <p className="text-sm text-ink-muted">{text}</p>
    </Card>
  )
}

//One small square per person in line, so a busy line looks busy at a glance
function LineMeter({ waiting, label, muted = false }) {
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <span aria-hidden="true" className="flex gap-[3px]">
        {Array.from({ length: METER_SLOTS }, (_, slot) => (
          <span
            key={slot}
            className={`size-2 rounded-xs ${slot < waiting ? (muted ? 'bg-ink-subtle' : 'bg-accent') : 'bg-line'}`}
          />
        ))}
      </span>
      <span className="text-xs text-ink-muted tabular-nums">{label}</span>
    </div>
  )
}

//An open service: the whole card is a link to join it (or to your status if you're already in it)
function OpenTile({ service, isShortest }) {
  return (
    <Card className="group relative flex h-full flex-col px-5 py-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-ink">
          {/* The link stretches over the whole card so the card is one big click target */}
          <Link to={service.to} className="after:absolute after:inset-0">
            {service.name}
          </Link>
        </h3>
        {service.isMine && (
          <span className="shrink-0 rounded-sm border border-accent/20 bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
            You're in this line
          </span>
        )}
        {isShortest && (
          <span className="shrink-0 rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            Shortest wait
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{service.description}</p>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink tabular-nums">
        {service.isMine ? ordinal(service.position) : `~${formatWait(service.wait)}`}
        <span className="ml-1.5 text-sm font-normal tracking-normal text-ink-muted">
          {service.isMine ? 'in line' : 'if you join now'}
        </span>
      </p>
      <LineMeter waiting={service.waiting} label={service.waiting === 0 ? 'No one in line' : `${service.waiting} in line`} />

      <div className="mt-4 flex flex-1 items-end justify-between gap-3 border-t border-line pt-3 text-xs">
        <span className="text-ink-subtle tabular-nums">About {service.expectedDuration} min per person</span>
        <span className="inline-flex items-center gap-1 font-medium text-accent">
          {service.action}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Card>
  )
}

//A closed service: flat, dashed and faded, and not a link because no one new can join
//(unless you were already in the line when it closed, then it links to your status)
function ClosedTile({ service, people }) {
  const stillWaiting = service.waiting === 0 ? 'No one in line' : `${service.waiting} still in line`

  return (
    <div className="group relative flex h-full flex-col rounded-sm border border-dashed border-line-strong bg-canvas/60 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-ink-muted">
          {service.isMine ? (
            <Link to={service.to} className="after:absolute after:inset-0">
              {service.name}
            </Link>
          ) : (
            service.name
          )}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
          <Lock aria-hidden="true" className="size-3" strokeWidth={2} />
          Closed
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{service.description}</p>

      <p className="mt-3 text-base font-medium text-ink-muted">
        {service.isMine ? `You keep your place: ${ordinal(service.position)} in line` : `Not taking new ${people} right now`}
      </p>
      <LineMeter waiting={service.waiting} label={stillWaiting} muted />

      <div className="mt-4 flex flex-1 items-end justify-between gap-3 border-t border-dashed border-line-strong pt-3 text-xs">
        <span className="text-ink-subtle tabular-nums">About {service.expectedDuration} min per person</span>
        {service.isMine ? (
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            View status
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        ) : (
          <span className="text-ink-subtle">Can't join right now</span>
        )}
      </div>
    </div>
  )
}

function peopleAhead(count) {
  if (count === 0) return 'No one ahead of you'
  return count === 1 ? '1 person ahead of you' : `${count} people ahead of you`
}

//bar from when you joined to when your turn should come, filled up to now
function WaitTimeline({ joinedAt, waitMinutes, now }) {
  const start = new Date(joinedAt).getTime()
  const end = now + waitMinutes * 60_000
  const done = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1
  const percent = Math.round(done * 100)
  //Keep the "Now" label inside the card when the marker sits near either end
  const labelLeft = Math.min(90, Math.max(10, percent))

  return (
    <div className="mt-6">
      <div className="relative h-4">
        <span
          className="absolute -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent"
          style={{ left: `${labelLeft}%` }}
        >
          Now
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Time until your turn"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="relative mt-1.5 h-1.5 rounded-full bg-line"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${percent}%` }} />
        <span className="absolute left-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-accent" />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-card"
          style={{ left: `${percent}%` }}
        />
        <span className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-line-strong bg-surface" />
      </div>
      <div className="mt-2.5 flex justify-between gap-4 text-xs">
        <p>
          <span className="block text-ink-subtle">Joined</span>
          <span className="font-medium text-ink tabular-nums">{formatTime(joinedAt)}</span>
        </p>
        <p className="text-right">
          <span className="block text-ink-subtle">Your turn around</span>
          <span className="font-medium text-ink tabular-nums">~{formatTime(new Date(end).toISOString())}</span>
        </p>
      </div>
    </div>
  )
}
