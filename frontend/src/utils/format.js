const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function formatDate(iso) {
  return dateFormat.format(new Date(iso))
}

export function formatTime(iso) {
  return timeFormat.format(new Date(iso))
}

export function minutesBetween(startIso, endIso) {
  return Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / 60_000))
}

// "45 min", "1 hr", "1 hr 15 min"
export function formatWait(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

// Current estimate: position in line x expected minutes per person.
export function estimateWait(position, expectedDuration) {
  return position * expectedDuration
}

export function formatRelative(iso, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso)) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return formatDate(iso)
}

export function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
