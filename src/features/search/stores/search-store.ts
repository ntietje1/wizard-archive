import { create } from 'zustand'

interface SearchState {
  isOpen: boolean
  query: string
}

interface SearchActions {
  open: () => void
  close: () => void
  setQuery: (query: string) => void
}

export const useSearchStore = create<SearchState & SearchActions>()((set) => ({
  isOpen: false,
  query: '',
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, query: '' }),
  setQuery: (query) => set({ query }),
}))
