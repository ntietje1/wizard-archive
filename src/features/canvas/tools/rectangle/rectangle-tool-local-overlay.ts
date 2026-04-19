import { create } from 'zustand'
import type { Bounds } from '../../utils/canvas-geometry-utils'

interface RectangleToolLocalOverlayState {
  dragRect: Bounds | null
}

interface RectangleToolLocalOverlayActions {
  setDragRect: (rect: Bounds | null) => void
  reset: () => void
}

export const useRectangleToolLocalOverlayStore = create<
  RectangleToolLocalOverlayState & RectangleToolLocalOverlayActions
>((set) => ({
  dragRect: null,
  setDragRect: (rect) => set({ dragRect: rect }),
  reset: () => set({ dragRect: null }),
}))

export function setRectangleToolDragRect(rect: Bounds | null) {
  useRectangleToolLocalOverlayStore.getState().setDragRect(rect)
}

export function clearRectangleToolLocalOverlay() {
  useRectangleToolLocalOverlayStore.getState().reset()
}
