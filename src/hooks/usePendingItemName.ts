import { createContext, useContext } from 'react'

export const PendingItemNameContext = createContext<{
  pendingItemName: string
  setPendingItemName: (name: string) => void
}>({
  pendingItemName: '',
  setPendingItemName: () => {},
})

export function usePendingItemName() {
  return useContext(PendingItemNameContext)
}
