import { create } from 'zustand'
import type { DrawingState } from '../utils/canvas-awareness-types'
import type { Bounds } from '../utils/canvas-stroke-utils'

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'draw'
  | 'erase'
  | 'lasso'
  | 'rectangle'

const TOOL_CURSORS: Record<CanvasTool, string | undefined> = {
  select: undefined,
  hand: 'grab',
  draw: 'crosshair',
  erase: 'cell',
  lasso: 'crosshair',
  rectangle: 'crosshair',
}

export function getToolCursor(tool: CanvasTool): string | undefined {
  return TOOL_CURSORS[tool]
}

interface CanvasToolState {
  activeTool: CanvasTool
  strokeColor: string
  strokeSize: number
  strokeOpacity: number
  erasingStrokeIds: Set<string>
  localDrawing: DrawingState | null
  lassoPath: Array<{ x: number; y: number }>
  selectionRect: Bounds | null
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasTool) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
  setErasingStrokeIds: (ids: Set<string>) => void
  setLocalDrawing: (drawing: DrawingState | null) => void
  setLassoPath: (path: Array<{ x: number; y: number }>) => void
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
  localDrawing: null,
  lassoPath: [],
  selectionRect: null,
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
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
    setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

    setErasingStrokeIds: (ids) => set({ erasingStrokeIds: ids }),
    setLocalDrawing: (drawing) => set({ localDrawing: drawing }),
    setLassoPath: (path) => set({ lassoPath: path }),
    setSelectionRect: (rect) => set({ selectionRect: rect }),

    setHistory: (history) => set(history),

    reset: () => set(INITIAL_STATE),
  }),
)
