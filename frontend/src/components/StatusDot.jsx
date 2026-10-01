// The one status indicator used across the app: a small circle, in the color of
// the thing it describes. Pass pulse for something happening right now and two
// rings ripple out from it. Size is fixed on purpose so a status reads the same
// on every screen, inside a badge or standing on its own.
export function StatusDot({ className = '', pulse = false }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${pulse ? 'status-pulse' : ''} ${className}`}
    />
  )
}
