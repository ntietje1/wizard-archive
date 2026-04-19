import { create } from 'zustand'
import type { Bounds } from '../../utils/canvas-geometry-utils'

interface SelectToolLocalOverlayState {
  selectionDragRect: Bounds | null
  rectDeselectedIds: Set<string>
}

interface SelectToolLocalOverlayActions {
  setSelectionDragRect: (rect: Bounds | null) => void
  setRectDeselectedIds: (ids: Set<string>) => void
  reset: () => void
}

const EMPTY_DESELECTED_IDS = new Set<string>()

export const useSelectToolLocalOverlayStore = create<
  SelectToolLocalOverlayState & SelectToolLocalOverlayActions
>((set) => ({
  selectionDragRect: null,
  rectDeselectedIds: EMPTY_DESELECTED_IDS,
  setSelectionDragRect: (rect) => set({ selectionDragRect: rect }),
  setRectDeselectedIds: (ids) => set({ rectDeselectedIds: ids }),
  reset: () =>
    set({
      selectionDragRect: null,
      rectDeselectedIds: EMPTY_DESELECTED_IDS,
    }),
}))

export function setSelectToolSelectionDragRect(rect: Bounds | null) {
  useSelectToolLocalOverlayStore.getState().setSelectionDragRect(rect)
}

export function setSelectToolRectDeselectedIds(ids: Set<string>) {
  useSelectToolLocalOverlayStore.getState().setRectDeselectedIds(ids)
}

export function clearSelectToolLocalOverlay() {
  useSelectToolLocalOverlayStore.getState().reset()
}
