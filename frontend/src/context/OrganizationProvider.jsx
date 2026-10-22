import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { OrganizationContext } from './organization'

const STORAGE_KEY = 'queuesmart:organization'

function readSavedId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// The organization whose queues are being shown, loaded from the API.
// The choice survives reloads. Children wait for the list, because almost every
// screen reads organization.name or its wording for the people waiting.
export function OrganizationProvider({ children }) {
  const [organizations, setOrganizations] = useState([])
  const [organizationId, setId] = useState(readSavedId)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get('/organizations')
      .then((found) => {
        if (cancelled) return
        setOrganizations(found)
        // Fall back to the first one if nothing was saved, or the saved one is gone.
        setId((current) => (found.some((o) => o.id === current) ? current : found[0]?.id))
      })
      .catch((cause) => {
        if (!cancelled) setError(cause)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setOrganizationId = useCallback((id) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage can be unavailable (private windows); the choice then lasts until reload.
    }
  }, [])

  const organization = organizations.find((o) => o.id === organizationId)

  const value = useMemo(
    () => ({
      organizations,
      organization,
      // What this organization calls the people waiting, e.g. "Patient".
      personLabel: organization?.personSingular ?? 'Visitor',
      setOrganizationId,
    }),
    [organizations, organization, setOrganizationId],
  )

  if (error) return <Unavailable />
  if (!organization) return null

  return <OrganizationContext value={value}>{children}</OrganizationContext>
}

// The API is the only source of organizations now, so there is nothing to show
// without it. Most often this means the backend is not running.
function Unavailable() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-lg font-semibold text-ink">Can’t reach the server</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Start the API with <code className="rounded-xs bg-sunken px-1 py-0.5">python -m app.main</code> in the{' '}
          <code className="rounded-xs bg-sunken px-1 py-0.5">backend</code> folder, then reload this page.
        </p>
      </div>
    </div>
  )
}
