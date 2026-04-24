import { create } from 'zustand'
import type { DrawingState } from '../../utils/canvas-awareness-types'

interface DrawToolLocalOverlayState {
  localDrawing: DrawingState | null
}

interface DrawToolLocalOverlayActions {
  setLocalDrawing: (drawing: DrawingState | null) => void
  reset: () => void
}

export const useDrawToolLocalOverlayStore = create<
  DrawToolLocalOverlayState & DrawToolLocalOverlayActions
>((set) => ({
  localDrawing: null,
  setLocalDrawing: (drawing) => set({ localDrawing: drawing }),
  reset: () => set({ localDrawing: null }),
}))

export function setDrawToolLocalDrawing(drawing: DrawingState | null) {
  useDrawToolLocalOverlayStore.getState().setLocalDrawing(drawing)
}

export function clearDrawToolLocalOverlay() {
  useDrawToolLocalOverlayStore.getState().reset()
}
