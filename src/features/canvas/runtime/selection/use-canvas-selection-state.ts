import { useCanvasEngineSelector } from '../../react/use-canvas-engine'

export function useSelectedCanvasNodeIds() {
  return useCanvasEngineSelector((state) => state.selection.nodeIds)
}

export function useIsCanvasNodeSelected(id: string) {
  return useCanvasEngineSelector((state) => state.selection.nodeIds.has(id))
}
