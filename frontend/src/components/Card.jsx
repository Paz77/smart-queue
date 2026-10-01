// Near-opaque on purpose: the backdrop photo is sharp at the bottom of the page,
// and text needs a calm surface to sit on rather than a moving picture.
export function Card({ className = '', children }) {
  return <section className={`rounded-sm border border-line/80 bg-surface/97 shadow-card backdrop-blur-md ${className}`}>{children}</section>
}

// The card title is a step larger than the body text inside the card, so a page
// of cards reads as a set of labelled sections rather than one flat wall.
export function CardHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] leading-5 font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
