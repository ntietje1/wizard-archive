import { create } from 'zustand'
import type { CanvasDragGuide } from './canvas-drag-snap-utils'

interface CanvasDragSnapOverlayState {
  guides: Array<CanvasDragGuide>
  setGuides: (guides: Array<CanvasDragGuide>) => void
  clear: () => void
}

export const useCanvasDragSnapOverlayStore = create<CanvasDragSnapOverlayState>((set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  clear: () => set({ guides: [] }),
}))

export function setCanvasDragSnapGuides(guides: Array<CanvasDragGuide>) {
  useCanvasDragSnapOverlayStore.getState().setGuides(guides)
}

export function clearCanvasDragSnapGuides() {
  useCanvasDragSnapOverlayStore.getState().clear()
}
