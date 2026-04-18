import { create } from 'zustand'

interface CanvasHistoryState {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

interface CanvasHistoryActions {
  setHistory: (history: CanvasHistoryState) => void
  reset: () => void
}

const INITIAL_STATE: CanvasHistoryState = {
  canUndo: false,
  canRedo: false,
  undo: () => {},
  redo: () => {},
}

export const useCanvasHistoryStore = create<CanvasHistoryState & CanvasHistoryActions>((set) => ({
  ...INITIAL_STATE,
  setHistory: (history) => set(history),
  reset: () => set(INITIAL_STATE),
}))
