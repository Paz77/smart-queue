import { useCallback, useMemo, useState } from 'react'
import { organizations } from '../mocks/organizations'
import { OrganizationContext } from './organization'

const STORAGE_KEY = 'queuesmart:organization'

function readSavedId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// The organization whose queues are being shown. The choice survives reloads.
export function OrganizationProvider({ children }) {
  const [organizationId, setId] = useState(() => {
    const saved = readSavedId()
    return organizations.some((o) => o.id === saved) ? saved : organizations[0].id
  })

  const setOrganizationId = useCallback((id) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage can be unavailable (private windows); the choice then lasts until reload.
    }
  }, [])

  const value = useMemo(() => {
    const organization = organizations.find((o) => o.id === organizationId)
    return {
      organizations,
      organization,
      // What this organization calls the people waiting, e.g. "Patient".
      personLabel: organization.personSingular ?? 'Visitor',
      setOrganizationId,
    }
  }, [organizationId, setOrganizationId])

  return <OrganizationContext value={value}>{children}</OrganizationContext>
}
