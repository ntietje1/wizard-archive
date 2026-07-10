import { createContext, use } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { DndBatchDecision } from './batch-decision'
import type { DropOutcome } from './outcome'
import type { SidebarItemId } from '../../../../shared/common/ids'

interface DndState {
  activeDropTargetKey: string | null
  dragPreviewItemIds: Array<SidebarItemId>
  dragOutcome: DropOutcome | null
  externalFileDropTargetKey: string | null
  isDraggingFiles: boolean
  isDraggingElement: boolean
  batchDecision: DndBatchDecision | null
}

interface DndActions {
  setActiveDropTargetKey: (key: string | null) => void
  setDragPreviewItemIds: (ids: Array<SidebarItemId>) => void
  setDragOutcome: (outcome: DropOutcome | null) => void
  setExternalFileDropTargetKey: (key: string | null) => void
  setIsDraggingFiles: (isDragging: boolean) => void
  setIsDraggingElement: (isDragging: boolean) => void
  setBatchDecision: (decision: DndBatchDecision | null) => void
}

type DndStoreState = DndState & DndActions
type DndStore = StoreApi<DndStoreState>

const initialDndState: DndState = {
  activeDropTargetKey: null,
  dragPreviewItemIds: [],
  dragOutcome: null,
  externalFileDropTargetKey: null,
  isDraggingFiles: false,
  isDraggingElement: false,
  batchDecision: null,
}

function sameItemIds(a: Array<SidebarItemId>, b: Array<SidebarItemId>) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function createDndStore(): DndStore {
  return createStore<DndStoreState>()((set) => ({
    ...initialDndState,

    setActiveDropTargetKey: (key) =>
      set((state) => {
        if (state.activeDropTargetKey === key) return state
        return { activeDropTargetKey: key }
      }),
    setDragPreviewItemIds: (ids) =>
      set((state) =>
        sameItemIds(state.dragPreviewItemIds, ids) ? state : { dragPreviewItemIds: ids },
      ),
    setDragOutcome: (outcome) =>
      set((state) => (state.dragOutcome === outcome ? state : { dragOutcome: outcome })),
    setExternalFileDropTargetKey: (key) =>
      set((state) =>
        state.externalFileDropTargetKey === key ? state : { externalFileDropTargetKey: key },
      ),
    setIsDraggingFiles: (isDragging) =>
      set((state) =>
        state.isDraggingFiles === isDragging ? state : { isDraggingFiles: isDragging },
      ),
    setIsDraggingElement: (isDragging) =>
      set((state) =>
        state.isDraggingElement === isDragging ? state : { isDraggingElement: isDragging },
      ),
    setBatchDecision: (decision) =>
      set((state) => (state.batchDecision === decision ? state : { batchDecision: decision })),
  }))
}

const defaultDndStore = createDndStore()

export const DndStoreContext = createContext<DndStore | null>(null)

DndStoreContext.displayName = 'DndStoreContext'

export function useDndStoreApi(): DndStore {
  return use(DndStoreContext) ?? defaultDndStore
}

export const useDndStore = Object.assign(function useDndStore<T>(
  selector: (state: DndStoreState) => T,
): T {
  return useStore(useDndStoreApi(), selector)
}, defaultDndStore)
