import { createContext, useContext, useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { SidebarDragData } from '~/lib/dnd-utils'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/hooks/useCampaign'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

export type SidebarLayoutContextType = {
  isSidebarExpanded: boolean
  setIsSidebarExpanded: (isExpanded: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isEditorSettingsLoaded: boolean
}

export const SidebarLayoutContext =
  createContext<SidebarLayoutContextType | null>(null)

export const useSidebarLayout = (): SidebarLayoutContextType => {
  const context = useContext(SidebarLayoutContext)
  if (!context) {
    throw new Error(
      'useSidebarLayout must be used within a SidebarLayoutProvider',
    )
  }
  return context
}

export type FileSidebarContextType = {
  setRenamingId: (id: SidebarItemId | null) => void
  renamingId: SidebarItemId | null
  setDeletingId: (id: SidebarItemId | null) => void
  deletingId: SidebarItemId | null

  folderStates: Record<string, boolean>
  setFolderState: (folderId: string, isOpen: boolean) => void
  toggleFolderState: (folderId: string) => void
  openFolder: (folderId: string) => void
  closeFolder: (folderId: string) => void
  clearAllFolderStates: () => void
  activeDragItem: SidebarDragData | null
  closeAllFoldersMode: boolean
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
  fileDragHoveredId: Id<'folders'> | null
  setFileDragHoveredId: (id: Id<'folders'> | null) => void
  isDraggingFiles: boolean
  setIsDraggingFiles: (isDragging: boolean) => void
  bookmarksOnlyMode: boolean
  toggleBookmarksOnlyMode: () => void
}

export const useFileSidebar = (): FileSidebarContextType => {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const store = useSidebarUIStore(
    useShallow((s) => ({
      renamingId: s.renamingId,
      setRenamingId: s.setRenamingId,
      deletingId: s.deletingId,
      setDeletingId: s.setDeletingId,
      activeDragItem: s.activeDragItem,
      fileDragHoveredId: s.fileDragHoveredId,
      setFileDragHoveredId: s.setFileDragHoveredId,
      isDraggingFiles: s.isDraggingFiles,
      setIsDraggingFiles: s.setIsDraggingFiles,
      campaignStates: s.campaignStates,
      setFolderState: s.setFolderState,
      toggleFolderState: s.toggleFolderState,
      clearAllFolderStates: s.clearAllFolderStates,
      toggleCloseAllFoldersMode: s.toggleCloseAllFoldersMode,
      exitCloseAllMode: s.exitCloseAllMode,
      toggleBookmarksOnlyMode: s.toggleBookmarksOnlyMode,
    })),
  )

  const campaignState = campaignId
    ? store.campaignStates[campaignId]
    : undefined

  return useMemo(() => {
    const cid = campaignId ?? ''
    return {
      renamingId: store.renamingId,
      setRenamingId: store.setRenamingId,
      deletingId: store.deletingId,
      setDeletingId: store.setDeletingId,
      activeDragItem: store.activeDragItem,
      fileDragHoveredId: store.fileDragHoveredId,
      setFileDragHoveredId: store.setFileDragHoveredId,
      isDraggingFiles: store.isDraggingFiles,
      setIsDraggingFiles: store.setIsDraggingFiles,

      folderStates: campaignState?.folderStates ?? {},
      closeAllFoldersMode: campaignState?.closeAllFoldersMode ?? false,
      bookmarksOnlyMode: campaignState?.bookmarksOnlyMode ?? false,

      setFolderState: (folderId: string, isOpen: boolean) =>
        store.setFolderState(cid, folderId, isOpen),
      toggleFolderState: (folderId: string) =>
        store.toggleFolderState(cid, folderId),
      openFolder: (folderId: string) =>
        store.setFolderState(cid, folderId, true),
      closeFolder: (folderId: string) =>
        store.setFolderState(cid, folderId, false),
      clearAllFolderStates: () => store.clearAllFolderStates(cid),
      toggleCloseAllFoldersMode: () => store.toggleCloseAllFoldersMode(cid),
      exitCloseAllMode: () => store.exitCloseAllMode(cid),
      toggleBookmarksOnlyMode: () => store.toggleBookmarksOnlyMode(cid),
    }
  }, [store, campaignId, campaignState])
}
