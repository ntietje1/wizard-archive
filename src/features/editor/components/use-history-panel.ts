import { createContext, useContext } from 'react'

export type HistoryPanelContextType = {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

export const HistoryPanelContext = createContext<HistoryPanelContextType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export function useHistoryPanel() {
  return useContext(HistoryPanelContext)
}
