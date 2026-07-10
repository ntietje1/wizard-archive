import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { DrawingState, Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-geometry-utils'

interface CanvasToolLocalOverlayState {
  drawLocalDrawing: DrawingState | null
  eraseErasingStrokeIds: Set<string>
  lassoPoints: Array<Point2D>
  rectCreationDragRect: Bounds | null
  selectSelectionDragRect: Bounds | null
}

export interface CanvasToolLocalOverlayControls {
  setDrawLocalDrawing: (drawing: DrawingState | null) => void
  setEraseErasingStrokeIds: (ids: ReadonlySet<string>) => void
  setLassoPoints: (points: Array<Point2D>) => void
  setRectCreationDragRect: (rect: Bounds | null) => void
  setSelectSelectionDragRect: (rect: Bounds | null) => void
  clearDraw: () => void
  clearErase: () => void
  clearLasso: () => void
  clearRectCreation: () => void
  clearSelect: () => void
  reset: () => void
}

export type CanvasToolLocalOverlayStore = StoreApi<
  CanvasToolLocalOverlayState & CanvasToolLocalOverlayControls
>

function createInitialState(): CanvasToolLocalOverlayState {
  return {
    drawLocalDrawing: null,
    eraseErasingStrokeIds: new Set<string>(),
    lassoPoints: [],
    rectCreationDragRect: null,
    selectSelectionDragRect: null,
  }
}

export function createCanvasToolLocalOverlayStore(): CanvasToolLocalOverlayStore {
  return createStore<CanvasToolLocalOverlayState & CanvasToolLocalOverlayControls>()((set) => ({
    ...createInitialState(),

    setDrawLocalDrawing: (drawLocalDrawing) => set({ drawLocalDrawing }),
    setEraseErasingStrokeIds: (ids) => set({ eraseErasingStrokeIds: new Set(ids) }),
    setLassoPoints: (lassoPoints) => set({ lassoPoints }),
    setRectCreationDragRect: (rectCreationDragRect) => set({ rectCreationDragRect }),
    setSelectSelectionDragRect: (selectSelectionDragRect) => set({ selectSelectionDragRect }),

    clearDraw: () => set({ drawLocalDrawing: null }),
    clearErase: () => set({ eraseErasingStrokeIds: new Set<string>() }),
    clearLasso: () => set({ lassoPoints: [] }),
    clearRectCreation: () => set({ rectCreationDragRect: null }),
    clearSelect: () => set({ selectSelectionDragRect: null }),
    reset: () => set(createInitialState()),
  }))
}
