import { create } from 'zustand'
import type { CanvasClipboardEntry } from './canvas-context-menu-types'

interface CanvasClipboardState {
  clipboard: CanvasClipboardEntry | null
}

interface CanvasClipboardActions {
  setClipboard: (clipboard: CanvasClipboardEntry | null) => void
  incrementPasteCount: () => void
}

export const useCanvasClipboardStore = create<CanvasClipboardState & CanvasClipboardActions>(
  (set) => ({
    clipboard: null,
    setClipboard: (clipboard) => set({ clipboard }),
    incrementPasteCount: () =>
      set((state) =>
        state.clipboard
          ? {
              clipboard: {
                ...state.clipboard,
                pasteCount: state.clipboard.pasteCount + 1,
              },
            }
          : state,
      ),
  }),
)
