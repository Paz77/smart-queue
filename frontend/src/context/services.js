import { createContext, useContext } from 'react'

export const ServiceContext = createContext(null)

export function useServices() {
  const context = useContext(ServiceContext)
  if (!context) throw new Error('useServices must be used inside <ServiceProvider>')
  return context
}
