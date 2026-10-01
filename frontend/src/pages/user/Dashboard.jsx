import { ArrowRight, Bell, Check, History as HistoryIcon, ListPlus, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card, CardHeader } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { PriorityBadge } from '../../components/PriorityBadge'
import { StatTile } from '../../components/StatTile'
import { StatusBadge } from '../../components/StatusBadge'
import { StatusDot } from '../../components/StatusDot'
import { NOTIFICATION_TYPES } from '../../components/notificationTypes'
import { useAuth } from '../../context/auth'
import { useNotifications } from '../../context/notifications'
import { useOrganization } from '../../context/organization'
import { useQueue } from '../../context/queue'
import { estimateWait, formatDate, formatRelative, formatWait, ordinal } from '../../utils/format'

const SUMMARY_LIMIT = 3
const RECENT_VISITS = 3

// Deep link that opens the Join Queue screen with this service already picked.
const joinLink = (service) => `/app/join?service=${service.id}`

export default function Dashboard() {
  const { currentUser } = useAuth()
  const { organization, personLabel } = useOrganization()
  const { services, entriesFor, myEntry, getService, history } = useQueue()
  const { notifications, unreadCount } = useNotifications()

  const firstName = currentUser.name.split(' ')[0]

  const rows = services.map((service) => {
    const waiting = entriesFor(service.id).length
    return {
      ...service,
      waiting,
      // What someone joining right now would wait: everyone ahead of them, plus their own turn.
      waitIfJoining: service.isOpen ? formatWait(estimateWait(waiting + 1, service.expectedDuration)) : null,
    }
  })

  const openRows = rows.filter((service) => service.isOpen)
  const isServed = myEntry?.status === 'served'
  const myService = myEntry ? getService(myEntry.serviceId) : null
  const lineLength = myEntry ? entriesFor(myEntry.serviceId).length : 0
  const myWait = myEntry && !isServed ? estimateWait(myEntry.position, myService.expectedDuration) : null

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${firstName}`}
        description={`Your place in line at ${organization.name}, what is open right now, and your latest updates.`}
        actions={
          <Button as={Link} to="/app/join">
            <ListPlus />
            Join a queue
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          label="Your position"
          value={myEntry && !isServed ? myEntry.position : '—'}
          hint={myEntry && !isServed ? `of ${lineLength} in line` : 'Not in a queue'}
        />
        <StatTile
          label="Estimated wait"
          value={myWait === null ? '—' : formatWait(myWait)}
          hint={myEntry && !isServed ? myService.name : 'Join a queue to see this'}
        />
        <StatTile
          label="Open now"
          value={
            <>
              {openRows.length}
              <span className="ml-1.5 text-sm font-normal tracking-normal text-ink-subtle">of {rows.length}</span>
            </>
          }
          hint={
            <span aria-hidden="true" className="mt-3.5 flex gap-[3px]">
              {rows.map((service) => (
                <span key={service.id} className={`h-1 flex-1 rounded-xs ${service.isOpen ? 'bg-accent' : 'bg-line'}`} />
              ))}
            </span>
          }
        />
        <StatTile
          label="Unread updates"
          value={unreadCount}
          hint={unreadCount === 0 ? 'You are up to date' : 'Open the bell to read them'}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <CurrentQueue
            entry={myEntry}
            service={myService}
            lineLength={lineLength}
            wait={myWait}
            isServed={isServed}
          />
          <ActiveServices rows={rows} openCount={openRows.length} canJoin={!myEntry || isServed} people={organization.personPlural} />
        </div>

        <div className="min-w-0 space-y-6">
          <NotificationSummary notifications={notifications} unreadCount={unreadCount} />
          <RecentVisits history={history} getService={getService} personLabel={personLabel} />
        </div>
      </div>
    </>
  )
}

// The signed-in person's live queue, or a prompt to join one.
function CurrentQueue({ entry, service, lineLength, wait, isServed }) {
  if (!entry) {
    return (
      <Card>
        <CardHeader title="Your queue" description="You are not waiting for anything right now." />
        <EmptyState
          icon={Timer}
          title="No active queue"
          description="Pick a service to see its estimated wait and take a place in line."
          action={
            <Button as={Link} to="/app/join">
              <ListPlus />
              Browse services
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Your queue"
        description={isServed ? 'Your most recent visit' : 'Live, and updated each time the desk calls someone forward'}
        action={
          <Button as={Link} to="/app/status" variant="secondary" size="sm">
            View status
            <ArrowRight />
          </Button>
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="font-medium text-ink">{service.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{service.description}</p>
        </div>
        <StatusBadge status={entry.status} live={!isServed} />
      </div>

      {isServed ? (
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Check className="size-4.5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-muted">
            You were called to the desk. This visit is now in your{' '}
            <Link to="/app/history" className="font-medium text-accent hover:underline">
              history
            </Link>
            .
          </p>
        </div>
      ) : (
        <dl aria-live="polite" className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric label="Position" value={ordinal(entry.position)} hint={`of ${lineLength} in line`} />
          <Metric label="Estimated wait" value={formatWait(wait)} hint={`About ${service.expectedDuration} min per person`} />
          <Metric label="Ahead of you" value={entry.position - 1} hint={entry.position - 1 === 1 ? 'person' : 'people'} />
        </dl>
      )}
    </Card>
  )
}

// Same responsive pattern as the Queue Status metrics.
function Metric({ label, value, hint }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-5 py-3.5 sm:block sm:py-4">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="row-span-2 text-xl font-semibold tracking-tight text-ink tabular-nums sm:mt-1.5 sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-ink-subtle sm:mt-1">{hint}</dd>
    </div>
  )
}

function ActiveServices({ rows, openCount, canJoin, people }) {
  const description = openCount
    ? `${openCount} of ${rows.length} taking new ${people.toLowerCase()} right now`
    : 'Every queue is closed at the moment'

  return (
    <Card>
      <CardHeader
        title="Services"
        description={description}
        action={
          <Button as={Link} to="/app/join" variant="secondary" size="sm">
            See all
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No services yet"
          description="Nothing has been published here yet. Check back soon."
        />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((service) => (
            <li key={service.id} className={`px-5 py-4 transition-colors ${service.isOpen ? 'hover:bg-sunken' : 'bg-canvas/60 hover:bg-canvas'}`}>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusDot className={service.isOpen ? 'bg-emerald-600' : 'bg-red-600'} pulse={service.isOpen} />
                    <p className={`truncate font-medium ${service.isOpen ? 'text-ink' : 'text-ink-muted'}`}>
                      {service.name}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted">
                    <PriorityBadge priority={service.priority} />
                    <span className="tabular-nums">{service.waiting} in line</span>
                    <span className="tabular-nums">
                      {service.waitIfJoining ? `~${service.waitIfJoining} if you join now` : 'Closed to new arrivals'}
                    </span>
                  </div>
                </div>

                {service.isOpen && canJoin && (
                  <Button as={Link} to={joinLink(service)} variant="secondary" size="sm">
                    Join
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function NotificationSummary({ notifications, unreadCount }) {
  const recent = notifications.slice(0, SUMMARY_LIMIT)

  return (
    <Card>
      <CardHeader
        title="Notifications"
        description={unreadCount ? `${unreadCount} unread` : 'Nothing new'}
      />

      {recent.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="Queue and status updates will appear here." />
      ) : (
        <>
          <ol className="divide-y divide-line">
            {recent.map((notification) => {
              const { icon: Icon, label } = NOTIFICATION_TYPES[notification.type]
              return (
                <li key={notification.id} className="flex gap-3 px-5 py-3.5">
                  <span
                    className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm border ${
                      notification.read
                        ? 'border-line bg-sunken text-ink-subtle'
                        : 'border-accent/20 bg-accent-soft text-accent'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
                    <span className="sr-only">{label}</span>
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm ${notification.read ? 'text-ink-muted' : 'font-medium text-ink'}`}>
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{notification.message}</p>
                    <p className="mt-1 text-[11px] text-ink-subtle">{formatRelative(notification.createdAt)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
            Showing {recent.length} of {notifications.length}. Open the bell in the top bar for the rest.
          </p>
        </>
      )}
    </Card>
  )
}

function RecentVisits({ history, getService, personLabel }) {
  const recent = history
    .slice()
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
    .slice(0, RECENT_VISITS)

  return (
    <Card>
      <CardHeader
        title="Recent visits"
        description={recent.length ? 'Your last few queues' : undefined}
        action={
          recent.length ? (
            <Button as={Link} to="/app/history" variant="secondary" size="sm">
              All
            </Button>
          ) : undefined
        }
      />

      {recent.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No visits yet"
          description={`Queues you join as a ${personLabel.toLowerCase()} will be listed here.`}
        />
      ) : (
        <ol className="divide-y divide-line">
          {recent.map((visit) => (
            <li key={visit.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{getService(visit.serviceId)?.name}</p>
                <p className="mt-0.5 text-xs text-ink-subtle tabular-nums">{formatDate(visit.joinedAt)}</p>
              </div>
              <StatusBadge status={visit.outcome} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
