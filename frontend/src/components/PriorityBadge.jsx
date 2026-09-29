const PRIORITY_META = {
  low: { label: 'Low', level: 1 },
  medium: { label: 'Medium', level: 2 },
  high: { label: 'High', level: 3 },
}

const BAR_HEIGHTS = [4, 7, 10]

// Service priority, shown as signal bars. Neutral on purpose, with no dot, so it
// never reads as a status badge.
export function PriorityBadge({ priority }) {
  const { label, level } = PRIORITY_META[priority]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong bg-surface py-0.5 pr-2 pl-1.5 text-xs font-medium whitespace-nowrap text-ink-muted">
      <svg viewBox="0 0 12 12" aria-hidden="true" className="size-3">
        {BAR_HEIGHTS.map((height, index) => (
          <rect
            key={height}
            x={1 + index * 4}
            y={11 - height}
            width="2"
            height={height}
            className={index < level ? 'fill-ink-muted' : 'fill-line-strong'}
          />
        ))}
      </svg>
      <span className="sr-only">Priority:</span>
      {label}
    </span>
  )
}
