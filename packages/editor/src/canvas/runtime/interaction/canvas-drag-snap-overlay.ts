import { create } from 'zustand'
import type { CanvasDragGuide } from '../../utils/canvas-snap-guides'

interface CanvasDragSnapOverlayState {
  guides: ReadonlyArray<CanvasDragGuide>
  setGuides: (guides: ReadonlyArray<CanvasDragGuide>) => void
  clear: () => void
}

export const useCanvasDragSnapOverlayStore = create<CanvasDragSnapOverlayState>((set) => ({
  guides: [],
  setGuides: (guides) => set({ guides }),
  clear: () => set({ guides: [] }),
}))

export function setCanvasDragSnapGuides(guides: ReadonlyArray<CanvasDragGuide>) {
  useCanvasDragSnapOverlayStore.getState().setGuides(guides)
}

export function clearCanvasDragSnapGuides() {
  useCanvasDragSnapOverlayStore.getState().clear()
}
