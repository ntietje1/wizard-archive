import { create } from 'zustand'
import type { DrawingState, Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'

interface CanvasInteractionState {
  erasingStrokeIds: Set<string>
  rectDeselectedIds: Set<string>
  localDrawing: DrawingState | null
  lassoPath: Array<Point2D>
  selectionDragRect: Bounds | null
}

interface CanvasInteractionActions {
  setErasingStrokeIds: (ids: Set<string>) => void
  setRectDeselectedIds: (ids: Set<string>) => void
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLassoPath: (path: Array<Point2D>) => void
  setSelectionDragRect: (rect: Bounds | null) => void
  reset: () => void
}

function createInitialCanvasInteractionState(): CanvasInteractionState {
  return {
    erasingStrokeIds: new Set(),
    rectDeselectedIds: new Set(),
    localDrawing: null,
    lassoPath: [],
    selectionDragRect: null,
  }
}

export function clearCanvasInteractionState() {
  useCanvasInteractionStore.getState().reset()
}

export const useCanvasInteractionStore = create<CanvasInteractionState & CanvasInteractionActions>(
  (set) => ({
    ...createInitialCanvasInteractionState(),
    setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
    setRectDeselectedIds: (ids) => set({ rectDeselectedIds: ids }),
    setLocalDrawing: (drawing) => set({ localDrawing: drawing }),
    setLassoPath: (path) => set({ lassoPath: path }),
    setSelectionDragRect: (rect) => set({ selectionDragRect: rect }),
    reset: () => set(createInitialCanvasInteractionState()),
  }),
)
