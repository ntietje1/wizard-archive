import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { useShallow } from 'zustand/shallow'
import { STROKE_SIZE_OPTIONS } from '../properties/canvas-property-definitions'
import type { CanvasToolId, CanvasToolPropertyContext } from '../tools/canvas-tool-types'

interface CanvasToolState {
  activeTool: CanvasToolId
  edgeType: 'bezier' | 'straight' | 'step'
  strokeColor: string
  strokeSize: number
  strokeOpacity: number
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasToolId) => void
  setEdgeType: (type: CanvasToolState['edgeType']) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
  reset: () => void
}

export type CanvasToolStore = StoreApi<CanvasToolState & CanvasToolActions>

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  edgeType: 'bezier',
  strokeColor: 'var(--foreground)',
  strokeSize: STROKE_SIZE_OPTIONS[2],
  strokeOpacity: 100,
}

export function createCanvasToolStore(): CanvasToolStore {
  return createStore<CanvasToolState & CanvasToolActions>()((set) => ({
    ...INITIAL_STATE,

    setActiveTool: (tool) => set({ activeTool: tool }),
    setEdgeType: (edgeType) => set({ edgeType }),

    setStrokeColor: (color) => set({ strokeColor: color }),
    setStrokeSize: (size) => set({ strokeSize: size }),
    setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

    reset: () => set(INITIAL_STATE),
  }))
}

export function useCanvasToolPropertyContext(
  toolStore: CanvasToolStore,
): CanvasToolPropertyContext {
  const subscribedSettings = useStore(
    toolStore,
    useShallow((state) => ({
      edgeType: state.edgeType,
      strokeColor: state.strokeColor,
      strokeOpacity: state.strokeOpacity,
      strokeSize: state.strokeSize,
    })),
  )

  return {
    toolState: {
      getSettings: () => subscribedSettings,
      setEdgeType: (type) => toolStore.getState().setEdgeType(type),
      setStrokeColor: (color) => toolStore.getState().setStrokeColor(color),
      setStrokeOpacity: (opacity) => toolStore.getState().setStrokeOpacity(opacity),
      setStrokeSize: (size) => toolStore.getState().setStrokeSize(size),
    },
  }
}
