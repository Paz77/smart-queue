import { STATUS_META } from '../utils/status'
import { StatusDot } from './StatusDot'

// Works for live statuses (waiting, almost_ready, served) and past outcomes (left, no_show).
// Pass live for a status that is happening right now; its dot pulses.
export function StatusBadge({ status, live = false }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${meta.className}`}>
      <StatusDot className={meta.dot} pulse={live} />
      {meta.label}
    </span>
  )
}
