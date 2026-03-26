import { create } from 'zustand'
import type { DropOutcome } from '~/features/dnd/utils/dnd-registry'
import type { Id } from 'convex/_generated/dataModel'

interface DndState {
  sidebarDragTargetId: string | null
  dragOutcome: DropOutcome | null
  fileDragHoveredId: Id<'folders'> | null
  isDraggingFiles: boolean
  isDraggingElement: boolean
}

interface DndActions {
  setSidebarDragTargetId: (id: string | null) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setFileDragHoveredId: (id: Id<'folders'> | null) => void
  setIsDraggingFiles: (isDragging: boolean) => void
  setIsDraggingElement: (isDragging: boolean) => void
}

export const useDndStore = create<DndState & DndActions>()((set) => ({
  sidebarDragTargetId: null,
  dragOutcome: null,
  fileDragHoveredId: null,
  isDraggingFiles: false,
  isDraggingElement: false,

  setSidebarDragTargetId: (id) =>
    set((state) => {
      if (state.sidebarDragTargetId === id) return state
      return { sidebarDragTargetId: id }
    }),
  setDragOutcome: (outcome) => set({ dragOutcome: outcome }),
  setFileDragHoveredId: (id) => set({ fileDragHoveredId: id }),
  setIsDraggingFiles: (isDragging) => set({ isDraggingFiles: isDragging }),
  setIsDraggingElement: (isDragging) => set({ isDraggingElement: isDragging }),
}))
