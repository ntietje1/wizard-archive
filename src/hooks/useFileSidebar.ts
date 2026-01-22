import { createContext, useContext } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'

export type FileSidebarContextType = {
  setRenamingId: (id: SidebarItemId | null) => void
  renamingId: SidebarItemId | null
  setDeletingId: (id: SidebarItemId | null) => void
  deletingId: SidebarItemId | null

  folderStates: Record<string, boolean>
  setFolderState: (folderId: string, isOpen: boolean) => void
  openFolder: (folderId: string) => void
  closeFolder: (folderId: string) => void
  clearAllFolderStates: () => void
  activeDragItem: SidebarDragData | null
  closeAllFoldersMode: boolean
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
  fileDragHoveredId: SidebarItemId | null
  setFileDragHoveredId: (id: SidebarItemId | null) => void
  isDraggingFiles: boolean
  setIsDraggingFiles: (isDragging: boolean) => void
  isSidebarExpanded: boolean
  setIsSidebarExpanded: (isExpanded: boolean) => void
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isEditorSettingsLoaded: boolean
  bookmarksOnlyMode: boolean
  toggleBookmarksOnlyMode: () => void
}

export const FileSidebarContext = createContext<FileSidebarContextType | null>(
  null,
)

export const useFileSidebar = (): FileSidebarContextType => {
  const context = useContext(FileSidebarContext)
  if (!context) {
    throw new Error('useFileSidebar must be used within a FileSidebarProvider')
  }
  return context
}
