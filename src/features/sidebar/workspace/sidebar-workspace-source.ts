import { createContext, createElement, useContext } from 'react'
import type { SidebarItemId } from 'shared/common/ids'
import type { SortOptions } from 'shared/editor/types'
import type { SidebarItemsContextValue, SidebarItemsValue } from '../contexts/sidebar-items-context'

interface SidebarWorkspaceUiState {
  folderStates: Record<string, boolean>
  closeAllFoldersMode: boolean
  bookmarksOnlyMode: boolean
}

interface SidebarWorkspaceUiCommands {
  setFolderState: (folderId: string, isOpen: boolean) => void
  toggleFolderState: (folderId: string) => void
  clearAllFolderStates: () => void
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
  toggleBookmarksOnlyMode: () => void
}

interface SidebarWorkspaceCommands {
  openParentFolders: (itemId: SidebarItemId) => void
}

interface SidebarWorkspaceSort {
  options: SortOptions
  setOptions: (options: SortOptions) => void
}

export interface SidebarWorkspaceSource {
  items: SidebarItemsContextValue
  filteredActiveItems: SidebarItemsValue
  ui: SidebarWorkspaceUiState
  uiCommands: SidebarWorkspaceUiCommands
  commands: SidebarWorkspaceCommands
  sort: SidebarWorkspaceSort
}

const SidebarWorkspaceSourceContext = createContext<SidebarWorkspaceSource | null>(null)

export function SidebarWorkspaceSourceProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SidebarWorkspaceSource
}) {
  return createElement(SidebarWorkspaceSourceContext.Provider, { value }, children)
}

export function useSidebarWorkspaceSource() {
  const source = useContext(SidebarWorkspaceSourceContext)
  if (!source) {
    throw new Error('useSidebarWorkspaceSource must be used within SidebarWorkspaceSourceProvider')
  }
  return source
}
