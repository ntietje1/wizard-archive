import { createContext, useContext } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemType } from 'convex/sidebarItems/types'
import type { SidebarDragData } from '~/lib/dnd-utils'

export type FileSidebarContextType = {
  setRenamingId: (id: Id<SidebarItemType> | null) => void
  renamingId: Id<SidebarItemType> | null
  setDeletingId: (id: Id<SidebarItemType> | null) => void
  deletingId: Id<SidebarItemType> | null

  folderStates: Record<string, boolean>
  setFolderState: (folderId: string, isOpen: boolean) => void
  openFolder: (folderId: string) => void
  closeFolder: (folderId: string) => void
  clearAllFolderStates: () => void
  activeDragItem: SidebarDragData | null
  closeAllFoldersMode: boolean
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
}

export const FileSidebarContext = createContext<FileSidebarContextType | null>(
  null,
)

export const useFileSidebar = () => {
  const context = useContext(FileSidebarContext)
  if (!context) {
    throw new Error('useFileSidebar must be used within a FileSidebarProvider')
  }
  return context
}
