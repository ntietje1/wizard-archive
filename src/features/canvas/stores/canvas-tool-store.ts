import { create } from 'zustand'
import { STROKE_SIZE_OPTIONS } from '../properties/canvas-property-definitions'
import type { CanvasToolId } from '../tools/canvas-tool-types'
import { clearCanvasToolLocalOverlays } from '../tools/canvas-tool-modules'

interface CanvasToolState {
  activeTool: CanvasToolId
  strokeColor: string
  strokeSize: number
  strokeOpacity: number
}

interface CanvasToolActions {
  setActiveTool: (tool: CanvasToolId) => void
  setStrokeColor: (color: string) => void
  setStrokeSize: (size: number) => void
  setStrokeOpacity: (opacity: number) => void
  reset: () => void
}

const INITIAL_STATE: CanvasToolState = {
  activeTool: 'select',
  strokeColor: 'var(--foreground)',
  strokeSize: STROKE_SIZE_OPTIONS[1],
  strokeOpacity: 100,
}

export const useCanvasToolStore = create<CanvasToolState & CanvasToolActions>((set) => ({
  ...INITIAL_STATE,

  setActiveTool: (tool) => {
    clearCanvasToolLocalOverlays()
    set({ activeTool: tool })
  },

  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeSize: (size) => set({ strokeSize: size }),
  setStrokeOpacity: (opacity) => set({ strokeOpacity: opacity }),

  reset: () => {
    clearCanvasToolLocalOverlays()
    set(INITIAL_STATE)
  },
}))
