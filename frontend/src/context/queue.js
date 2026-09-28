import { createContext, useContext } from 'react'

export const QueueContext = createContext(null)

export function useQueue() {
  const context = useContext(QueueContext)
  if (!context) throw new Error('useQueue must be used inside <QueueProvider>')
  return context
}
