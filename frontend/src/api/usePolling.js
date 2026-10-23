import { useEffect, useRef } from 'react'

export const DEFAULT_INTERVAL_MS = 5000

// Re-runs `callback` on an interval, so a queue position or notification count
// keeps up with what the backend says without anyone refreshing the page.
//
//   usePolling(loadQueue)                       // every 5 seconds
//   usePolling(loadQueue, { enabled: signedIn }) // only while signed in
//
// Three things it takes care of:
//   - the callback can change every render without restarting the timer
//   - a slow response never stacks up behind the next tick
//   - a hidden tab stops polling, and refreshes once when it comes back
export function usePolling(callback, { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = {}) {
  // Kept in a ref so a new function identity each render does not resubscribe.
  // Updated in an effect rather than during render, which keeps the render pure.
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let inFlight = false
    let timer

    async function tick() {
      // Skip this round if the last one has not come back yet.
      if (inFlight || document.hidden) return
      inFlight = true
      try {
        await callbackRef.current()
      } catch {
        // A failed poll is not worth interrupting anyone over; the next one
        // either succeeds or the screen's own error state takes over.
      } finally {
        inFlight = false
      }
    }

    function onVisibilityChange() {
      // Catch up straight away rather than waiting out the interval.
      if (!document.hidden && !cancelled) tick()
    }

    tick()
    timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, enabled])
}
