import { create } from 'zustand'
import { clearCanvasInteractionState } from '../hooks/useCanvasInteractionStore'
import { getCanvasToolModule } from '../tools/canvas-tool-modules'
import type { CanvasToolId } from '../tools/canvas-tool-types'

interface CanvasToolState {
  activeTool: CanvasToolId
  strokeColor: string
  strokeSize: number
  strokeOpacity: number
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasToolId) => void
  completeActiveToolAction: () => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
  reset: () => void
}

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  strokeColor: 'var(--foreground)',
  strokeSize: 4,
  strokeOpacity: 100,
}

export const useCanvasToolStore = create<CanvasToolState & CanvasToolActions>((set) => ({
  ...INITIAL_STATE,

  setActiveTool: (tool) => {
    clearCanvasInteractionState()
    set({ activeTool: tool })
  },

  completeActiveToolAction: () => {
    clearCanvasInteractionState()
    set((state) => (getCanvasToolModule(state.activeTool)?.oneShot ? { activeTool: 'select' } : {}))
  },

  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: size }),
  setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

  reset: () => {
    clearCanvasInteractionState()
    set(INITIAL_STATE)
  },
}))
