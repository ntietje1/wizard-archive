import { useCanvasToolStore } from './canvas-tool-store'
import type { CanvasToolPropertyContext, CanvasToolStateControls } from '../tools/canvas-tool-types'

function getCanvasToolSettings() {
  const state = useCanvasToolStore.getState()
  return {
    strokeColor: state.strokeColor,
    strokeOpacity: state.strokeOpacity,
    strokeSize: state.strokeSize,
  }
}

export const canvasToolStateControls: CanvasToolStateControls = {
  getSettings: getCanvasToolSettings,
  getActiveTool: () => useCanvasToolStore.getState().activeTool,
  setActiveTool: (tool) => useCanvasToolStore.getState().setActiveTool(tool),
  setStrokeColor: (color) => useCanvasToolStore.getState().setStrokeColor(color),
  setStrokeSize: (size) => useCanvasToolStore.getState().setStrokeSize(size),
  setStrokeOpacity: (opacity) => useCanvasToolStore.getState().setStrokeOpacity(opacity),
}

export function useCanvasToolPropertyContext(): CanvasToolPropertyContext {
  const strokeColor = useCanvasToolStore((state) => state.strokeColor)
  const strokeOpacity = useCanvasToolStore((state) => state.strokeOpacity)
  const strokeSize = useCanvasToolStore((state) => state.strokeSize)

  return {
    toolState: {
      getSettings: () => ({
        strokeColor,
        strokeOpacity,
        strokeSize,
      }),
      setStrokeColor: canvasToolStateControls.setStrokeColor,
      setStrokeOpacity: canvasToolStateControls.setStrokeOpacity,
      setStrokeSize: canvasToolStateControls.setStrokeSize,
    },
  }
}
