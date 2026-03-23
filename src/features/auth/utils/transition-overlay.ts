import { create } from 'zustand'

type TransitionOverlayStore = {
  message: string | null
  show: (message: string) => void
  hide: () => void
}

export const useTransitionOverlay = create<TransitionOverlayStore>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}))
