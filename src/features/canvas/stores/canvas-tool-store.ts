import { create } from 'zustand'
import type { DrawingState, Point2D } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'
import type { CanvasTool } from '../utils/canvas-toolbar-utils'
import { shouldResetToolAfterAction } from '../utils/canvas-toolbar-utils'

interface CanvasToolState {
  activeTool: CanvasTool
  strokeColor: string
  strokeSize: number
  strokeOpacity: number
  erasingStrokeIds: Set<string>
  rectDeselectedIds: Set<string>
  localDrawing: DrawingState | null
  lassoPath: Array<Point2D>
  selectionRect: Bounds | null
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasTool) => void
  completeActiveToolAction: () => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
  setErasingStrokeIds: (ids: Set<string>) => void
  setRectDeselectedIds: (ids: Set<string>) => void
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLassoPath: (path: Array<Point2D>) => void
  setSelectionRect: (rect: Bounds | null) => void
  setHistory: (history: {
    canUndo: boolean
    canRedo: boolean
    undo: () => void
    redo: () => void
  }) => void
  reset: () => void
}

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  strokeColor: 'var(--foreground)',
  strokeSize: 4,
  strokeOpacity: 100,
  erasingStrokeIds: new Set(),
  rectDeselectedIds: new Set(),
  localDrawing: null,
  lassoPath: [],
  selectionRect: null,
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
}

export const useCanvasToolStore = create<CanvasToolState & CanvasToolActions>((set) => ({
  ...INITIAL_STATE,

  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      erasingStrokeIds: new Set(),
      rectDeselectedIds: new Set(),
      localDrawing: null,
      lassoPath: [],
      selectionRect: null,
    }),

  completeActiveToolAction: () =>
    set((state) =>
      shouldResetToolAfterAction(state.activeTool)
        ? {
            activeTool: 'select',
            erasingStrokeIds: new Set(),
            rectDeselectedIds: new Set(),
            localDrawing: null,
            lassoPath: [],
            selectionRect: null,
          }
        : {},
    ),

  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: size }),
  setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

  setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
  setRectDeselectedIds: (ids) => set({ rectDeselectedIds: ids }),
  setLocalDrawing: (drawing) => set({ localDrawing: drawing }),
  setLassoPath: (path) => set({ lassoPath: path }),
  setSelectionRect: (rect) => set({ selectionRect: rect }),

  setHistory: (history) => set(history),

  reset: () =>
    set({
      ...INITIAL_STATE,
      erasingStrokeIds: new Set(),
      rectDeselectedIds: new Set(),
      lassoPath: [],
    }),
}))
