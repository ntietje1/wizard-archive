import type { ResourceId } from '../../resources/domain-id'
import { createContext, createElement, useContext, useMemo, useState } from 'react'

import type { FileSystemSelection } from '../../filesystem/selection'
import { DEFAULT_SORT_OPTIONS } from '../items-persistence-contract'
import type { SortOptions } from '../items-persistence-contract'
import { useClearSidebarWorkspaceStateOnUnmount, useStoredSidebarWorkspaceState } from './ui-store'

interface SidebarWorkspaceUiState {
  folderStates: Partial<Record<ResourceId, boolean>>
  closeAllFoldersMode: boolean
  bookmarksOnlyMode: boolean
}

interface SidebarWorkspaceUiCommands {
  setFolderState: (folderId: ResourceId, isOpen: boolean) => void
  toggleFolderState: (folderId: ResourceId) => void
  clearAllFolderStates: () => void
  toggleCloseAllFoldersMode: () => void
  exitCloseAllMode: () => void
  toggleBookmarksOnlyMode: () => void
}

export interface SidebarWorkspaceSort {
  options: SortOptions
  setOptions: (options: SortOptions) => void
}

interface SidebarWorkspaceEditing {
  renamingItemId: ResourceId | null
  setRenamingItemId: (itemId: ResourceId | null) => void
}

export type SidebarWorkspaceItemSurfaceName = 'sidebar' | 'folder-view' | 'bookmarks' | 'trash'

export interface SidebarWorkspaceItemSurface {
  surface: SidebarWorkspaceItemSurfaceName
  parentId: ResourceId | null
  visibleItemIds: ReadonlyArray<ResourceId>
}

export interface SidebarWorkspaceSelection {
  selectedItemIds: ReadonlyArray<ResourceId>
  focusedItemId: ResourceId | null
  activeItemSurface: SidebarWorkspaceItemSurface | null
}

export interface SidebarWorkspaceSelectionSnapshot extends SidebarWorkspaceSelection {
  anchorItemId: ResourceId | null
}

type SidebarWorkspaceSelectionCommands = Pick<
  FileSystemSelection,
  | 'setSelectedItemIds'
  | 'selectSingleItem'
  | 'toggleItemSelection'
  | 'selectItemRange'
  | 'setFocusedItem'
  | 'moveFocus'
  | 'clearItemSelection'
  | 'normalizeContextSelection'
> & {
  setActiveItemSurface: (surface: SidebarWorkspaceItemSurface | null) => void
  clearSelectionForWorkspaceChange: () => void
  getSelectionSnapshot: () => SidebarWorkspaceSelectionSnapshot
}

export interface SidebarWorkspaceState {
  ui: SidebarWorkspaceUiState
  uiCommands: SidebarWorkspaceUiCommands
  sort: SidebarWorkspaceSort
  editing: SidebarWorkspaceEditing
  selection: SidebarWorkspaceSelection
  selectionCommands: SidebarWorkspaceSelectionCommands
}

const SidebarWorkspaceStateContext = createContext<SidebarWorkspaceState | null>(null)

export function SidebarWorkspaceStateProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SidebarWorkspaceState
}) {
  return createElement(SidebarWorkspaceStateContext.Provider, { value }, children)
}

export function useSidebarWorkspaceState() {
  const source = useContext(SidebarWorkspaceStateContext)
  if (!source) {
    throw new Error('useSidebarWorkspaceState must be used within SidebarWorkspaceStateProvider')
  }
  return source
}

export function useRuntimeSidebarWorkspaceState(
  runtime: RuntimeSidebarWorkspaceStateSource,
): SidebarWorkspaceState {
  const sort = useDefaultWorkspaceSidebarSort()

  return useRuntimeSidebarWorkspaceStateWithSort(runtime, sort)
}

type RuntimeSidebarWorkspaceStateSource = {
  workspace: {
    id: string
    instanceId?: string
  }
}

export function useRuntimeSidebarWorkspaceStateWithSort(
  runtime: RuntimeSidebarWorkspaceStateSource,
  sort: SidebarWorkspaceSort,
): SidebarWorkspaceState {
  const workspaceId = runtime.workspace.instanceId ?? runtime.workspace.id
  useClearSidebarWorkspaceStateOnUnmount(workspaceId, workspaceId !== runtime.workspace.id)

  return useStoredSidebarWorkspaceState({
    sort,
    workspaceId,
  })
}

function useDefaultWorkspaceSidebarSort(): SidebarWorkspaceSort {
  const [options, setOptions] = useState<SortOptions>(DEFAULT_SORT_OPTIONS)
  return useMemo(() => ({ options, setOptions }), [options])
}
