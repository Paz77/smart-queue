import { Check, ListPlus, LogOut, Timer } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { StatusDot } from '../../components/StatusDot'
import { useNotifications } from '../../context/notifications'
import { useQueue } from '../../context/queue'
import { capitalize, estimateWait, formatRelative, formatTime, formatWait, minutesBetween, ordinal } from '../../utils/format'
import { STATUS_META, STATUS_STEPS } from '../../utils/status'

const STEP_COPY = {
  waiting: 'You are in line. We will notify you as you move up.',
  almost_ready: 'You are one of the next two. Start heading to the desk.',
  served: 'It is your turn. Go to the service desk.',
}

export default function QueueStatus() {
  const { myEntry, getService, entriesFor, leaveQueue, clearServed } = useQueue()
  const [confirmingLeave, setConfirmingLeave] = useState(false)

  const header = (
    <PageHeader
      eyebrow="Your queue"
      title="Queue status"
      description="Your live place in line. This page updates each time the desk calls someone forward."
    />
  )

  if (!myEntry) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={Timer}
            title="You are not in a queue"
            description="Join a queue to see your live position, estimated wait and status updates here."
            action={
              <Button as={Link} to="/app/join">
                <ListPlus />
                Browse services
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const service = getService(myEntry.serviceId)
  const line = entriesFor(myEntry.serviceId)
  const isServed = myEntry.status === 'served'

  return (
    <>
      {header}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">Service</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">{service.name}</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Joined at {formatTime(myEntry.joinedAt)}
                {!isServed && ` · ${line.length} ${line.length === 1 ? 'person' : 'people'} in line`}
              </p>
            </div>
            <StatusBadge status={myEntry.status} live />
          </div>

          {isServed ? (
            <>
              <div className="flex flex-col items-center border-b border-line px-6 py-10 text-center">
                <div className="grid size-12 place-items-center rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Check className="size-6" strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">It is your turn</h3>
                <p className="mt-1 max-w-sm text-sm text-ink-muted">
                  {service.name} called you at {formatTime(myEntry.servedAt)}. Please go to the service desk.
                </p>
              </div>
              <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Metric label="Joined" value={formatTime(myEntry.joinedAt)} />
                <Metric label="Called" value={formatTime(myEntry.servedAt)} />
                <Metric label="Total wait" value={formatWait(minutesBetween(myEntry.joinedAt, myEntry.servedAt))} />
              </dl>
            </>
          ) : (
            <>
              <dl aria-live="polite" className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Metric label="Position" value={myEntry.position} hint={`of ${line.length} in line`} />
                <Metric
                  label="Estimated wait"
                  value={formatWait(estimateWait(myEntry.position, service.expectedDuration))}
                  hint={`About ${service.expectedDuration} min per person`}
                />
                <Metric
                  label="Ahead of you"
                  value={myEntry.position - 1}
                  hint={myEntry.position - 1 === 1 ? 'person' : 'people'}
                />
              </dl>
              <LineView line={line} myEntryId={myEntry.id} />
            </>
          )}

          <div className="border-t border-line px-6 py-6">
            <StatusStepper status={myEntry.status} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-6 py-4">
            {isServed ? (
              <>
                <p className="min-w-48 flex-1 text-xs text-ink-muted">This visit has been added to your history.</p>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                  <Button variant="secondary" size="sm" as={Link} to="/app/history">
                    View history
                  </Button>
                  <Button size="sm" onClick={clearServed}>
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="min-w-48 flex-1 text-xs leading-relaxed text-ink-muted">
                  You can leave at any time. Joining again puts you at the back of the line.
                </p>
                <Button variant="danger" size="sm" className="w-full sm:w-auto" onClick={() => setConfirmingLeave(true)}>
                  <LogOut />
                  Leave queue
                </Button>
              </>
            )}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <ServiceDetails service={service} lineLength={line.length} />
          <RecentUpdates />
        </div>
      </div>

      <Modal
        open={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        title="Leave this queue?"
        description={`You will give up your place (${ordinal(myEntry.position)} in line) for ${service.name}. If you join again, you will start at the back of the line.`}
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

// On phones: label and hint on the left, value on the right. From sm up: stacked tile.
function Metric({ label, value, hint }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-6 py-4 sm:block sm:py-5">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="row-span-2 text-2xl font-semibold tracking-tight text-ink tabular-nums sm:mt-2 sm:text-3xl">
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-ink-subtle sm:mt-1">{hint}</dd>}
    </div>
  )
}

function LineView({ line, myEntryId }) {
  const myIndex = line.findIndex((entry) => entry.id === myEntryId)

  return (
    <div className="border-t border-line px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs font-medium text-ink-muted">Your place in line</p>
        <div className="flex items-center gap-3 text-[11px] text-ink-subtle">
          <LegendSwatch className="border-line bg-stone-100" label="Ahead" />
          <LegendSwatch className="border-accent bg-accent" label="You" />
          <LegendSwatch className="border-dashed border-line-strong bg-surface" label="Behind" />
        </div>
      </div>
      <ol aria-label="People in line, front first" className="mt-3 flex flex-wrap items-center gap-1.5">
        <li className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">Desk</li>
        {line.map((entry, index) => {
          const isMe = index === myIndex
          const tone = isMe
            ? 'border-accent bg-accent font-semibold text-white'
            : index < myIndex
              ? 'border-line bg-stone-100 text-ink-subtle'
              : 'border-dashed border-line-strong bg-surface text-ink-subtle'
          return (
            <li
              key={entry.id}
              aria-current={isMe ? 'true' : undefined}
              aria-label={isMe ? `Position ${entry.position}, you` : `Position ${entry.position}`}
              className={`grid size-8 place-items-center rounded-sm border text-xs tabular-nums ${tone}`}
            >
              {entry.position}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LegendSwatch({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2.5 rounded-xs border ${className}`} />
      {label}
    </span>
  )
}

function StatusStepper({ status }) {
  const current = STATUS_STEPS.indexOf(status)

  return (
    <ol aria-label="Queue progress" className="grid grid-cols-3 gap-3">
      {STATUS_STEPS.map((step, index) => {
        const done = index < current || status === 'served'
        const active = index === current && !done
        const reached = done || active
        return (
          <li key={step} aria-current={active ? 'step' : undefined}>
            <div className={`h-1 ${reached ? 'bg-accent' : 'bg-line'}`} />
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-xs border text-[10px] font-semibold tabular-nums ${
                  done
                    ? 'border-accent bg-accent text-white'
                    : active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line-strong text-ink-subtle'
                }`}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              <span className={`text-sm ${reached ? 'font-medium text-ink' : 'text-ink-subtle'}`}>
                {STATUS_META[step].label}
              </span>
            </div>
            <p className={`mt-1.5 hidden text-xs leading-relaxed sm:block ${active ? 'text-ink-muted' : 'text-ink-subtle'}`}>
              {STEP_COPY[step]}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function ServiceDetails({ service, lineLength }) {
  const rows = [
    ['Time per person', `${service.expectedDuration} min`],
    ['Priority', capitalize(service.priority)],
    [
      'Queue',
      <span key="queue" className="inline-flex items-center gap-2">
        <StatusDot className={service.isOpen ? 'bg-emerald-600' : 'bg-red-600'} pulse={service.isOpen} />
        {service.isOpen ? 'Open' : 'Closed'}
      </span>,
    ],
    ['In line now', lineLength],
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
    </Card>
  )
}

function RecentUpdates() {
  const { notifications } = useNotifications()
  const recent = notifications.slice(0, 4)

  return (
    <Card>
      <CardHeader title="Recent updates" description="Your latest queue and status notifications" />
      {recent.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">No updates yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {recent.map((notification) => (
            <li key={notification.id} className="flex gap-3 px-5 py-3.5">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-1.5 shrink-0 ${notification.read ? 'bg-line-strong' : 'bg-accent'}`}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{notification.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{notification.message}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{formatRelative(notification.createdAt)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
