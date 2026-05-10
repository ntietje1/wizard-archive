import { create } from 'zustand'
import type { DropOutcome } from '~/features/dnd/utils/drop-outcome'
import type { SurfaceBatchDropCommand } from '~/features/dnd/utils/surface-drop-planner'
import type { Id } from 'convex/_generated/dataModel'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'

export type FileDropOverride = (
  dropResult: DropResult,
  clientCoords: { x: number; y: number },
) => Promise<void>

export type DndBatchDecision = {
  command: Extract<SurfaceBatchDropCommand, { status: 'partial' | 'failed' }>
  onConfirm: () => Promise<void>
}

interface DndState {
  sidebarDragTargetId: string | null
  dragOutcome: DropOutcome | null
  fileDragHoveredId: Id<'sidebarItems'> | null
  isDraggingFiles: boolean
  isDraggingElement: boolean
  fileDropOverride: FileDropOverride | null
  batchDecision: DndBatchDecision | null
}

interface DndActions {
  setSidebarDragTargetId: (id: string | null) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setFileDragHoveredId: (id: Id<'sidebarItems'> | null) => void
  setIsDraggingFiles: (isDragging: boolean) => void
  setIsDraggingElement: (isDragging: boolean) => void
  setFileDropOverride: (handler: FileDropOverride | null) => void
  setBatchDecision: (decision: DndBatchDecision | null) => void
}

export const useDndStore = create<DndState & DndActions>()((set) => ({
  sidebarDragTargetId: null,
  dragOutcome: null,
  fileDragHoveredId: null,
  isDraggingFiles: false,
  isDraggingElement: false,
  fileDropOverride: null,
  batchDecision: null,

  setSidebarDragTargetId: (id) =>
    set((state) => {
      if (state.sidebarDragTargetId === id) return state
      return { sidebarDragTargetId: id }
    }),
  setDragOutcome: (outcome) => set({ dragOutcome: outcome }),
  setFileDragHoveredId: (id) => set({ fileDragHoveredId: id }),
  setIsDraggingFiles: (isDragging) => set({ isDraggingFiles: isDragging }),
  setIsDraggingElement: (isDragging) => set({ isDraggingElement: isDragging }),
  setFileDropOverride: (handler) => set({ fileDropOverride: handler }),
  setBatchDecision: (decision) => set({ batchDecision: decision }),
}))
