import { createContext, useContext } from 'react'

export const HistoryContext = createContext(null)

export function useHistory() {
  const context = useContext(HistoryContext)
  if (!context) throw new Error('useHistory must be used inside <HistoryProvider>')
  return context
}
