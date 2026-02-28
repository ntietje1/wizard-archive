import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { SidebarDragData, DragDropAction } from '~/lib/dnd-utils'
import type { Id } from 'convex/_generated/dataModel'

export type { DragDropAction } from '~/lib/dnd-utils'

interface CampaignState {
  folderStates: Record<string, boolean>
  closeAllFoldersMode: boolean
  bookmarksOnlyMode: boolean
}

interface SidebarUIState {
  // Campaign-scoped (persisted)
  campaignStates: Record<string, CampaignState>

  // Transient
  renamingId: SidebarItemId | null
  activeDragItem: SidebarDragData | null
  sidebarDragTargetId: string | null
  dragDropAction: DragDropAction
  fileDragHoveredId: Id<'folders'> | null
  isDraggingFiles: boolean
  pendingItemName: string
  selectedType: SidebarItemType | null
  selectedSlug: string | null
}

interface SidebarUIActions {
  setRenamingId: (id: SidebarItemId | null) => void
  setFolderState: (
    campaignId: string,
    folderId: string,
    isOpen: boolean,
  ) => void
  toggleFolderState: (campaignId: string, folderId: string) => void
  clearAllFolderStates: (campaignId: string) => void
  toggleCloseAllFoldersMode: (campaignId: string) => void
  exitCloseAllMode: (campaignId: string) => void
  toggleBookmarksOnlyMode: (campaignId: string) => void
  setActiveDragItem: (item: SidebarDragData | null) => void
  setSidebarDragTargetId: (id: string | null) => void
  setDragDropAction: (action: DragDropAction) => void
  setFileDragHoveredId: (id: Id<'folders'> | null) => void
  setIsDraggingFiles: (isDragging: boolean) => void
  setPendingItemName: (name: string) => void
  setSelected: (type: SidebarItemType | null, slug: string | null) => void
}

const defaultCampaignState: CampaignState = {
  folderStates: {},
  closeAllFoldersMode: false,
  bookmarksOnlyMode: false,
}

function getCampaignState(
  state: SidebarUIState,
  campaignId: string,
): CampaignState {
  return state.campaignStates[campaignId] ?? defaultCampaignState
}

function updateCampaignState(
  state: SidebarUIState,
  campaignId: string,
  updater: (prev: CampaignState) => Partial<CampaignState>,
): Partial<SidebarUIState> {
  const prev = getCampaignState(state, campaignId)
  return {
    campaignStates: {
      ...state.campaignStates,
      [campaignId]: { ...prev, ...updater(prev) },
    },
  }
}

export const useSidebarUIStore = create<SidebarUIState & SidebarUIActions>()(
  persist(
    (set) => ({
      // Campaign-scoped (persisted)
      campaignStates: {},

      // Transient
      renamingId: null,
      activeDragItem: null,
      sidebarDragTargetId: null,
      dragDropAction: null,
      fileDragHoveredId: null,
      isDraggingFiles: false,
      pendingItemName: '',
      selectedType: null,
      selectedSlug: null,

      // Actions
      setRenamingId: (id) => set({ renamingId: id }),

      setFolderState: (campaignId, folderId, isOpen) =>
        set((state) =>
          updateCampaignState(state, campaignId, (prev) => ({
            folderStates: { ...prev.folderStates, [folderId]: isOpen },
          })),
        ),

      toggleFolderState: (campaignId, folderId) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          return updateCampaignState(state, campaignId, () => ({
            folderStates: {
              ...prev.folderStates,
              [folderId]: !(prev.folderStates[folderId] ?? false),
            },
          }))
        }),

      clearAllFolderStates: (campaignId) =>
        set((state) =>
          updateCampaignState(state, campaignId, () => ({
            folderStates: {},
          })),
        ),

      toggleCloseAllFoldersMode: (campaignId) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          return updateCampaignState(state, campaignId, () => ({
            closeAllFoldersMode: !prev.closeAllFoldersMode,
          }))
        }),

      exitCloseAllMode: (campaignId) =>
        set((state) =>
          updateCampaignState(state, campaignId, () => ({
            closeAllFoldersMode: false,
          })),
        ),

      toggleBookmarksOnlyMode: (campaignId) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          return updateCampaignState(state, campaignId, () => ({
            bookmarksOnlyMode: !prev.bookmarksOnlyMode,
          }))
        }),

      setActiveDragItem: (item) => set({ activeDragItem: item }),
      setSidebarDragTargetId: (id) =>
        set((state) => {
          if (state.sidebarDragTargetId === id) return state
          return { sidebarDragTargetId: id }
        }),
      setDragDropAction: (action) =>
        set((state) => {
          if (state.dragDropAction === action) return state
          return { dragDropAction: action }
        }),
      setFileDragHoveredId: (id) => set({ fileDragHoveredId: id }),
      setIsDraggingFiles: (isDragging) => set({ isDraggingFiles: isDragging }),
      setPendingItemName: (name) => set({ pendingItemName: name }),

      setSelected: (type, slug) =>
        set((state) => {
          if (state.selectedType === type && state.selectedSlug === slug) {
            return state
          }
          return { selectedType: type, selectedSlug: slug }
        }),
    }),
    {
      name: 'sidebar-ui',
      partialize: (state) => ({
        campaignStates: state.campaignStates,
      }),
    },
  ),
)

const EMPTY_FOLDER_STATES: Record<string, boolean> = {}

export function useCampaignSidebarState(campaignId: string | undefined) {
  return useSidebarUIStore(
    useShallow((s) => {
      const cs = campaignId ? s.campaignStates[campaignId] : undefined
      return {
        folderStates: cs?.folderStates ?? EMPTY_FOLDER_STATES,
        closeAllFoldersMode: cs?.closeAllFoldersMode ?? false,
        bookmarksOnlyMode: cs?.bookmarksOnlyMode ?? false,
      }
    }),
  )
}

export function useCampaignSidebarActions(campaignId: string | undefined) {
  return useMemo(() => {
    if (!campaignId) {
      const noop = () => {}
      return {
        setFolderState: noop as (folderId: string, isOpen: boolean) => void,
        toggleFolderState: noop as (folderId: string) => void,
        clearAllFolderStates: noop,
        toggleCloseAllFoldersMode: noop,
        exitCloseAllMode: noop,
        toggleBookmarksOnlyMode: noop,
      }
    }
    return {
      setFolderState: (folderId: string, isOpen: boolean) =>
        useSidebarUIStore
          .getState()
          .setFolderState(campaignId, folderId, isOpen),
      toggleFolderState: (folderId: string) =>
        useSidebarUIStore.getState().toggleFolderState(campaignId, folderId),
      clearAllFolderStates: () =>
        useSidebarUIStore.getState().clearAllFolderStates(campaignId),
      toggleCloseAllFoldersMode: () =>
        useSidebarUIStore.getState().toggleCloseAllFoldersMode(campaignId),
      exitCloseAllMode: () =>
        useSidebarUIStore.getState().exitCloseAllMode(campaignId),
      toggleBookmarksOnlyMode: () =>
        useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId),
    }
  }, [campaignId])
}
