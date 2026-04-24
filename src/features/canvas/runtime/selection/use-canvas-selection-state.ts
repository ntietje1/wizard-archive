import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type {
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'

interface CanvasSelectionState {
  selectedNodeIds: Array<string>
  selectedEdgeIds: Array<string>
  gestureKind: CanvasSelectionGestureKind | null
}

interface CanvasSelectionStateActions {
  setSelection: (selection: CanvasSelectionSnapshot) => void
  beginGesture: (kind: CanvasSelectionGestureKind) => void
  endGesture: () => void
  reset: () => void
}

function createInitialCanvasSelectionState(): CanvasSelectionState {
  return {
    selectedNodeIds: [],
    selectedEdgeIds: [],
    gestureKind: null,
  }
}

export function clearCanvasSelectionState() {
  useCanvasSelectionState.getState().reset()
}

export const useCanvasSelectionState = create<CanvasSelectionState & CanvasSelectionStateActions>(
  (set) => ({
    ...createInitialCanvasSelectionState(),
    setSelection: ({ nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds }) =>
      set({ selectedNodeIds, selectedEdgeIds }),
    beginGesture: (gestureKind) => set({ gestureKind }),
    endGesture: () => set({ gestureKind: null }),
    reset: () => set(createInitialCanvasSelectionState()),
  }),
)

export function useSelectedCanvasNodeIds() {
  return useCanvasSelectionState(useShallow((state) => state.selectedNodeIds))
}

export function useIsCanvasNodeSelected(id: string) {
  return useCanvasSelectionState((state) => state.selectedNodeIds.includes(id))
}

export function useIsCanvasEdgeSelected(id: string) {
  return useCanvasSelectionState((state) => state.selectedEdgeIds.includes(id))
}

export function useIsCanvasSelectionGestureActive() {
  return useCanvasSelectionState((state) => state.gestureKind !== null)
}
