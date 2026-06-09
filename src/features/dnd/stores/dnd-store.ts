import { create } from 'zustand'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'
import type { SurfaceBatchDropCommand } from '~/features/dnd/utils/surface-drop-planner'
import type { Id } from 'convex/_generated/dataModel'

export type DndBatchDecision = {
  command: Extract<SurfaceBatchDropCommand, { status: 'partial' | 'failed' }>
  onConfirm: () => Promise<void>
}

interface DndState {
  sidebarDragTargetId: string | null
  sidebarDragPreviewItemIds: Array<Id<'sidebarItems'>>
  dragOutcome: DropOutcome | null
  fileDragHoveredTargetKey: string | null
  isDraggingFiles: boolean
  isDraggingElement: boolean
  batchDecision: DndBatchDecision | null
}

interface DndActions {
  setSidebarDragTargetId: (id: string | null) => void
  setSidebarDragPreviewItemIds: (ids: Array<Id<'sidebarItems'>>) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setFileDragHoveredTargetKey: (key: string | null) => void
  setIsDraggingFiles: (isDragging: boolean) => void
  setIsDraggingElement: (isDragging: boolean) => void
  setBatchDecision: (decision: DndBatchDecision | null) => void
}

export const useDndStore = create<DndState & DndActions>()((set, get) => ({
  sidebarDragTargetId: null,
  sidebarDragPreviewItemIds: [],
  dragOutcome: null,
  fileDragHoveredTargetKey: null,
  isDraggingFiles: false,
  isDraggingElement: false,
  batchDecision: null,

  setSidebarDragTargetId: (id) =>
    set((state) => {
      if (state.sidebarDragTargetId === id) return state
      return { sidebarDragTargetId: id }
    }),
  setSidebarDragPreviewItemIds: (ids) => {
    if (get().sidebarDragPreviewItemIds === ids) return
    set({ sidebarDragPreviewItemIds: ids })
  },
  setDragOutcome: (outcome) => set({ dragOutcome: outcome }),
  setFileDragHoveredTargetKey: (key) => set({ fileDragHoveredTargetKey: key }),
  setIsDraggingFiles: (isDragging) => set({ isDraggingFiles: isDragging }),
  setIsDraggingElement: (isDragging) => set({ isDraggingElement: isDragging }),
  setBatchDecision: (decision) => set({ batchDecision: decision }),
}))
