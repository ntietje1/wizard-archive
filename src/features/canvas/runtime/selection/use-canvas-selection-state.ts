import { useCanvasEngineSelector } from '../../react/use-canvas-engine'
import type { CanvasEngineEquality } from '../../system/canvas-engine'
import type {
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../../system/canvas-selection'

interface CanvasSelectionState {
  selectedNodeIds: ReadonlySet<string>
  selectedEdgeIds: ReadonlySet<string>
  gestureKind: CanvasSelectionGestureKind | null
}

export function useCanvasSelectionState<T>(
  selector: (state: CanvasSelectionState) => T,
  equality?: CanvasEngineEquality<T>,
) {
  return useCanvasEngineSelector(
    (snapshot) =>
      selector({
        selectedNodeIds: snapshot.selection.nodeIds,
        selectedEdgeIds: snapshot.selection.edgeIds,
        gestureKind: snapshot.selection.gestureKind,
      }),
    equality,
  )
}

export function useSelectedCanvasNodeIds() {
  return useCanvasEngineSelector((state) => state.selection.nodeIds)
}

export function useIsCanvasNodeSelected(id: string) {
  return useCanvasEngineSelector((state) => state.selection.nodeIds.has(id))
}

export function useIsCanvasEdgeSelected(id: string) {
  return useCanvasEngineSelector((state) => state.selection.edgeIds.has(id))
}

export function useIsCanvasSelectionGestureActive() {
  return useCanvasEngineSelector((state) => state.selection.gestureKind !== null)
}

export type { CanvasSelectionSnapshot }
