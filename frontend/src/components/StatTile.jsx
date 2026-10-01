import { Card } from './Card'

// A single headline number. hint can be a string, or a node for a small inline
// graphic (the admin overview passes a row of bars).
export function StatTile({ label, value, hint }) {
  return (
    <Card className="px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">{label}</p>
      <p className="mt-2 text-2xl leading-8 font-semibold tracking-tight text-ink tabular-nums sm:text-[28px]">{value}</p>
      {typeof hint === 'string' ? <p className="mt-2 text-xs text-ink-muted tabular-nums">{hint}</p> : hint}
    </Card>
  )
}
