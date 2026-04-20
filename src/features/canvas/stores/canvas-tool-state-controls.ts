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

const canvasToolPropertyContext: CanvasToolPropertyContext = {
  toolState: canvasToolStateControls,
}

export function useCanvasToolPropertyContext(): CanvasToolPropertyContext {
  // These selectors intentionally subscribe without using their return values so consumers rerender
  // when tool settings change while the shared context object stays referentially stable.
  useCanvasToolStore((state) => state.activeTool)
  useCanvasToolStore((state) => state.strokeColor)
  useCanvasToolStore((state) => state.strokeOpacity)
  useCanvasToolStore((state) => state.strokeSize)
  return canvasToolPropertyContext
}
