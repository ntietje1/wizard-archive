import { createContext, useContext } from 'react'

export const PendingItemNameContext = createContext<{
  pendingItemName: string
  setPendingItemName: (name: string) => void
}>(null!)

export function usePendingItemName() {
  return useContext(PendingItemNameContext)
}
