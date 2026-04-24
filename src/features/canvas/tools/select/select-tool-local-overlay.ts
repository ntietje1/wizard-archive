import { create } from 'zustand'
import type { Bounds } from '../../utils/canvas-geometry-utils'

interface SelectToolLocalOverlayState {
  selectionDragRect: Bounds | null
}

interface SelectToolLocalOverlayActions {
  setSelectionDragRect: (rect: Bounds | null) => void
  reset: () => void
}

export const useSelectToolLocalOverlayStore = create<
  SelectToolLocalOverlayState & SelectToolLocalOverlayActions
>((set) => ({
  selectionDragRect: null,
  setSelectionDragRect: (rect) => set({ selectionDragRect: rect }),
  reset: () =>
    set({
      selectionDragRect: null,
    }),
}))

export function setSelectToolSelectionDragRect(rect: Bounds | null) {
  useSelectToolLocalOverlayStore.getState().setSelectionDragRect(rect)
}

export function clearSelectToolLocalOverlay() {
  useSelectToolLocalOverlayStore.getState().reset()
}
