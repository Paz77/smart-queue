export function Card({ className = '', children }) {
  return <section className={`rounded-sm border border-line/80 bg-surface/92 shadow-card backdrop-blur-md ${className}`}>{children}</section>
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
