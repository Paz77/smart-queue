// A small status dot. Pass the color as a class (e.g. "bg-emerald-600") and
// pulse for things happening right now.
export function StatusDot({ className = '', size = 'size-1.5', pulse = false }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 ${size} ${pulse ? 'status-pulse' : ''} ${className}`} />
}
