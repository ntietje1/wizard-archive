import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { CanvasSelectionGestureKind } from '../../tools/canvas-tool-types'

interface CanvasSelectionState {
  selectedNodeIds: Array<string>
  gestureKind: CanvasSelectionGestureKind | null
}

interface CanvasSelectionStateActions {
  setSelectedNodeIds: (nodeIds: Array<string>) => void
  beginGesture: (kind: CanvasSelectionGestureKind) => void
  endGesture: () => void
  reset: () => void
}

function createInitialCanvasSelectionState(): CanvasSelectionState {
  return {
    selectedNodeIds: [],
    gestureKind: null,
  }
}

export function clearCanvasSelectionState() {
  useCanvasSelectionState.getState().reset()
}

export const useCanvasSelectionState = create<CanvasSelectionState & CanvasSelectionStateActions>(
  (set) => ({
    ...createInitialCanvasSelectionState(),
    setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
    beginGesture: (gestureKind) => set({ gestureKind }),
    endGesture: () => set({ gestureKind: null }),
    reset: () => set(createInitialCanvasSelectionState()),
  }),
)

export function useSelectedCanvasNodeIds() {
  return useCanvasSelectionState(useShallow((state) => state.selectedNodeIds))
}

export function useIsCanvasSelectionGestureActive() {
  return useCanvasSelectionState((state) => state.gestureKind !== null)
}
