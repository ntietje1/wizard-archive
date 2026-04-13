import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SearchState {
  isOpen: boolean
  query: string
  showPreview: boolean
}

interface SearchActions {
  open: () => void
  close: () => void
  setQuery: (query: string) => void
  togglePreview: () => void
}

export const useSearchStore = create<SearchState & SearchActions>()(
  persist(
    (set) => ({
      isOpen: false,
      query: '',
      showPreview: true,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false, query: '' }),
      setQuery: (query) => set({ query }),
      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
    }),
    {
      name: 'search-preferences',
      partialize: (state) => ({ showPreview: state.showPreview }),
    },
  ),
)
