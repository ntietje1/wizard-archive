import { create } from 'zustand'
import type { Bounds } from '../../utils/canvas-geometry-utils'

interface RectCreationLocalOverlayState {
  dragRect: Bounds | null
}

interface RectCreationLocalOverlayActions {
  setDragRect: (rect: Bounds | null) => void
  reset: () => void
}

export const useRectCreationLocalOverlayStore = create<
  RectCreationLocalOverlayState & RectCreationLocalOverlayActions
>((set) => ({
  dragRect: null,
  setDragRect: (rect) => set({ dragRect: rect }),
  reset: () => set({ dragRect: null }),
}))

export function setRectCreationDragRect(rect: Bounds | null) {
  useRectCreationLocalOverlayStore.getState().setDragRect(rect)
}

export function clearRectCreationLocalOverlay() {
  useRectCreationLocalOverlayStore.getState().reset()
}
