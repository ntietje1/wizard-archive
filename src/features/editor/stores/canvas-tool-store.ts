import { create } from 'zustand'
import type { DrawingState } from '../components/viewer/canvas/canvas-awareness-types'
import type { Bounds } from '../components/viewer/canvas/canvas-stroke-utils'

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'draw'
  | 'erase'
  | 'lasso'
  | 'rectangle'

interface CanvasToolState {
  activeTool: CanvasTool
  strokeColor: string
  strokeSize: number
  erasingStrokeIds: Set<string>
  localDrawing: DrawingState | null
  lassoPath: Array<{ x: number; y: number }>
  selectionRect: Bounds | null
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasTool) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setErasingStrokeIds: (ids: Set<string>) => void
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLassoPath: (path: Array<{ x: number; y: number }>) => void
  setSelectionRect: (rect: Bounds | null) => void
  reset: () => void
}

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  strokeColor: 'var(--foreground)',
  strokeSize: 4,
  erasingStrokeIds: new Set(),
  localDrawing: null,
  lassoPath: [],
  selectionRect: null,
}

export const useCanvasToolStore = create<CanvasToolState & CanvasToolActions>(
  (set) => ({
    ...INITIAL_STATE,

    setActiveTool: (tool) =>
      set({
        activeTool: tool,
        erasingStrokeIds: new Set(),
        localDrawing: null,
        lassoPath: [],
        selectionRect: null,
      }),

    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeSize: (size) => set({ strokeSize: size }),

    setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
    setLocalDrawing: (drawing) => set({ localDrawing: drawing }),
    setLassoPath: (path) => set({ lassoPath: path }),
    setSelectionRect: (rect) => set({ selectionRect: rect }),

    reset: () => set(INITIAL_STATE),
  }),
)
