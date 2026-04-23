import { create } from 'zustand'
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

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  edgeType: 'bezier',
  strokeColor: 'var(--foreground)',
  strokeSize: STROKE_SIZE_OPTIONS[2],
  strokeOpacity: 100,
}

export const useCanvasToolStore = create<CanvasToolState & CanvasToolActions>((set) => ({
  ...INITIAL_STATE,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setEdgeType: (edgeType) => set({ edgeType }),

  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: size }),
  setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

  reset: () => set(INITIAL_STATE),
}))

export function useCanvasToolPropertyContext(): CanvasToolPropertyContext {
  const subscribedSettings = useCanvasToolStore(
    useShallow((state) => ({
      edgeType: state.edgeType,
      strokeColor: state.strokeColor,
      strokeOpacity: state.strokeOpacity,
      strokeSize: state.strokeSize,
    })),
  )
  void subscribedSettings

  return {
    toolState: {
      getSettings: () => {
        const { edgeType, strokeColor, strokeOpacity, strokeSize } = useCanvasToolStore.getState()
        return {
          edgeType,
          strokeColor,
          strokeOpacity,
          strokeSize,
        }
      },
      setEdgeType: (type) => useCanvasToolStore.getState().setEdgeType(type),
      setStrokeColor: (color) => useCanvasToolStore.getState().setStrokeColor(color),
      setStrokeOpacity: (opacity) => useCanvasToolStore.getState().setStrokeOpacity(opacity),
      setStrokeSize: (size) => useCanvasToolStore.getState().setStrokeSize(size),
    },
  }
}
