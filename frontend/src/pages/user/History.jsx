import { History as HistoryIcon, ListPlus, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { SearchInput } from '../../components/SearchInput'
import { StatusBadge } from '../../components/StatusBadge'
import { useQueue } from '../../context/queue'
import { formatDate, formatTime, formatWait, minutesBetween } from '../../utils/format'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'served', label: 'Served' },
  { value: 'left', label: 'Left' },
  { value: 'no_show', label: 'No-show' },
]


export default function History() {
  const { history, getService } = useQueue()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const header = (
    <PageHeader
      eyebrow="Your activity"
      title="History"
      description="Every queue you have joined, newest first."
    />
  )

  if (history.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={HistoryIcon}
            title="No visits yet"
            description="Queues you join will be listed here with the date, service and outcome."
            action={
              <Button as={Link} to="/app/join">
                <ListPlus />
                Join a queue
              </Button>
            }
          />
        </Card>
      </>
    )
  }

  const served = history.filter((visit) => visit.outcome === 'served' && visit.servedAt)
  const averageWait = served.length
    ? Math.round(served.reduce((sum, visit) => sum + minutesBetween(visit.joinedAt, visit.servedAt), 0) / served.length)
    : 0
  const servedRate = Math.round((served.length / history.length) * 100)

  const countFor = (value) =>
    value === 'all' ? history.length : history.filter((visit) => visit.outcome === value).length

  const serviceName = (visit) => getService(visit.serviceId)?.name ?? 'Unknown service'
  const search = query.trim().toLowerCase()
  const rows = history
    .filter((visit) => filter === 'all' || visit.outcome === filter)
    .filter((visit) => !search || serviceName(visit).toLowerCase().includes(search))
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))

  function clearFilters() {
    setFilter('all')
    setQuery('')
  }

  return (
    <>
      {header}

      <dl className="mb-6 grid divide-y divide-line rounded-sm border border-line/80 bg-surface/97 shadow-card backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat label="Total visits" value={history.length} hint="Across all services" />
        <Stat label="Served" value={`${servedRate}%`} hint={`${served.length} of ${history.length} visits`} />
        <Stat label="Average wait" value={formatWait(averageWait)} hint="Completed visits only" />
      </dl>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div role="group" aria-label="Filter by outcome" className="flex rounded-sm border border-line bg-sunken p-0.5">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`flex h-7 items-center gap-1.5 rounded-xs px-3 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(22,24,29,0.08)] ring-1 ring-line'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {option.label}
                <span className="text-[10px] text-ink-subtle tabular-nums">{countFor(option.value)}</span>
              </button>
            ))}
          </div>

          <SearchInput
            label="Search by service name"
            placeholder="Search services"
            value={query}
            onChange={setQuery}
            className="w-full sm:w-64"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No visits match"
            description="Try a different outcome or search term."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Phones: one stacked row per visit. */}
            <ul className="divide-y divide-line sm:hidden">
              {rows.map((visit) => (
                <li key={visit.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{serviceName(visit)}</p>
                    <StatusBadge status={visit.outcome} />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted tabular-nums">
                    {formatDate(visit.joinedAt)} at {formatTime(visit.joinedAt)}
                    {visit.servedAt && ` \u00b7 waited ${formatWait(minutesBetween(visit.joinedAt, visit.servedAt))}`}
                  </p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line bg-sunken text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Service</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Joined</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Wait</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((visit) => (
                    <tr key={visit.id} className="transition-colors hover:bg-sunken">
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink tabular-nums">{formatDate(visit.joinedAt)}</td>
                      <td className="px-5 py-3.5 font-medium text-ink">{serviceName(visit)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-ink-muted tabular-nums">{formatTime(visit.joinedAt)}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-ink-muted tabular-nums">
                        {visit.servedAt ? formatWait(minutesBetween(visit.joinedAt, visit.servedAt)) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={visit.outcome} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="border-t border-line px-5 py-3 text-xs text-ink-muted">
          Showing {rows.length} of {history.length} visits
        </div>
      </Card>
    </>
  )
}

// Same responsive pattern as the Queue Status metrics.
function Stat({ label, value, hint }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-6 py-4 sm:block sm:py-5">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="row-span-2 text-xl font-semibold tracking-tight text-ink tabular-nums sm:mt-2 sm:text-2xl">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-ink-subtle sm:mt-1">{hint}</dd>
    </div>
  )
}
