import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'

type CanvasSelectionPhase = 'idle' | 'marquee' | 'lasso'

interface CanvasSelectionState {
  selectedNodeIds: Array<string>
  selectionPhase: CanvasSelectionPhase
}

interface CanvasSelectionActions {
  setSelectedNodeIds: (nodeIds: Array<string>) => void
  setSelectionPhase: (phase: CanvasSelectionPhase) => void
  reset: () => void
}

function createInitialCanvasSelectionState(): CanvasSelectionState {
  return {
    selectedNodeIds: [],
    selectionPhase: 'idle',
  }
}

export function clearCanvasSelectionState() {
  useCanvasSelectionState.getState().reset()
}

export const useCanvasSelectionState = create<CanvasSelectionState & CanvasSelectionActions>(
  (set) => ({
    ...createInitialCanvasSelectionState(),
    setSelectedNodeIds: (selectedNodeIds) => set({ selectedNodeIds }),
    setSelectionPhase: (selectionPhase) => set({ selectionPhase }),
    reset: () => set(createInitialCanvasSelectionState()),
  }),
)

export function useSelectedCanvasNodeIds() {
  return useCanvasSelectionState(useShallow((state) => state.selectedNodeIds))
}

export function useCanvasSelectionPhase() {
  return useCanvasSelectionState((state) => state.selectionPhase)
}
