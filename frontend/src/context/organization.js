import { createContext, useContext } from 'react'

export const OrganizationContext = createContext(null)

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) throw new Error('useOrganization must be used inside <OrganizationProvider>')
  return context
}
