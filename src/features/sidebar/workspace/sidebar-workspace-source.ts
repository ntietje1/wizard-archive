import { createContext, createElement, useContext } from 'react'
import type { SidebarItemId } from 'shared/common/ids'
import type { SortOptions } from 'shared/editor/types'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
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
  setRenamingItemId: (itemId: SidebarItemId | null) => void
}

interface SidebarWorkspaceSort {
  options: SortOptions
  setOptions: (options: SortOptions) => void
}

interface SidebarWorkspaceEditing {
  renamingItemId: SidebarItemId | null
}

export type SidebarWorkspaceItemSurfaceName = 'sidebar' | 'folder-view' | 'bookmarks' | 'trash'

export interface SidebarWorkspaceItemSurface {
  surface: SidebarWorkspaceItemSurfaceName
  parentId: SidebarItemId | null
  visibleItemIds: Array<SidebarItemId>
}

export interface SidebarWorkspaceSelection {
  selectedSlug: SidebarItemSlug | null
  selectedItemIds: Array<SidebarItemId>
  focusedItemId: SidebarItemId | null
  activeItemSurface: SidebarWorkspaceItemSurface | null
}

interface SidebarWorkspaceSelectionCommands {
  setSelected: (slug: SidebarItemSlug | null) => void
  setSelectedItemIds: (ids: Array<SidebarItemId>, anchorId?: SidebarItemId | null) => void
  selectSingleItem: (id: SidebarItemId) => void
  toggleItemSelection: (id: SidebarItemId) => void
  selectItemRange: (targetId: SidebarItemId, visibleItemIds: Array<SidebarItemId>) => void
  setFocusedItem: (id: SidebarItemId | null) => void
  moveFocus: (
    direction: 'up' | 'down',
    visibleItemIds: Array<SidebarItemId>,
    extendSelection: boolean,
  ) => void
  clearItemSelection: () => void
  normalizeContextSelection: (id: SidebarItemId, visibleItemIds?: Array<SidebarItemId>) => void
  setActiveItemSurface: (surface: SidebarWorkspaceItemSurface | null) => void
  getSelectionSnapshot: () => SidebarWorkspaceSelection
}

export interface SidebarWorkspaceSource {
  items: SidebarItemsContextValue
  filteredActiveItems: SidebarItemsValue
  ui: SidebarWorkspaceUiState
  uiCommands: SidebarWorkspaceUiCommands
  commands: SidebarWorkspaceCommands
  sort: SidebarWorkspaceSort
  editing: SidebarWorkspaceEditing
  selection: SidebarWorkspaceSelection
  selectionCommands: SidebarWorkspaceSelectionCommands
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
