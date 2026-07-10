import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { StoreApi } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import {
  getNextFileSystemFocusedItemId,
  resolveFileSystemSelectionRange,
  selectionBelongsToSurface,
} from '../../filesystem/selection'
import type {
  SidebarWorkspaceItemSurface,
  SidebarWorkspaceItemSurfaceName,
  SidebarWorkspaceSelectionSnapshot,
  SidebarWorkspaceState,
} from './workspace-state'
import { sameItemSurfaceWithVisibleIds } from './item-surface-comparison'

type ItemSurface = SidebarWorkspaceItemSurfaceName
type ActiveItemSurface = SidebarWorkspaceItemSurface

interface ItemSurfaceIdentity {
  surface: ItemSurface
  parentId: SidebarItemId | null
}

interface WorkspaceSidebarState {
  folderStates: Record<SidebarItemId, boolean>
  bookmarksOnlyMode: boolean
  closeAllFoldersMode: boolean
  renamingId: SidebarItemId | null
  selectedItemIds: Array<SidebarItemId>
  anchorItemId: SidebarItemId | null
  focusedItemId: SidebarItemId | null
  selectionSurface: ItemSurfaceIdentity | null
  focusSurface: ItemSurfaceIdentity | null
  activeItemSurface: ActiveItemSurface | null
}

interface SidebarUIState {
  workspaceStates: Record<string, WorkspaceSidebarState>
}

interface SidebarUIActions {
  setRenamingId: (workspaceId: string, id: SidebarItemId | null) => void
  setFolderState: (workspaceId: string, folderId: SidebarItemId, isOpen: boolean) => void
  toggleFolderState: (workspaceId: string, folderId: SidebarItemId) => void
  clearAllFolderStates: (workspaceId: string) => void
  toggleCloseAllFoldersMode: (workspaceId: string) => void
  exitCloseAllMode: (workspaceId: string) => void
  toggleBookmarksOnlyMode: (workspaceId: string) => void
  setSelectedItemIds: (
    workspaceId: string,
    ids: ReadonlyArray<SidebarItemId>,
    anchorId?: SidebarItemId | null,
  ) => void
  selectSingleItem: (workspaceId: string, id: SidebarItemId) => void
  toggleItemSelection: (workspaceId: string, id: SidebarItemId) => void
  selectItemRange: (
    workspaceId: string,
    targetId: SidebarItemId,
    visibleItemIds: ReadonlyArray<SidebarItemId>,
  ) => void
  setFocusedItem: (workspaceId: string, id: SidebarItemId | null) => void
  moveFocus: (
    workspaceId: string,
    direction: 'up' | 'down',
    visibleItemIds: ReadonlyArray<SidebarItemId>,
    extendSelection: boolean,
  ) => void
  clearItemSelection: (workspaceId: string) => void
  normalizeContextSelection: (
    workspaceId: string,
    id: SidebarItemId,
    visibleItemIds?: ReadonlyArray<SidebarItemId>,
  ) => void
  setActiveItemSurface: (workspaceId: string, surface: ActiveItemSurface | null) => void
  clearSelectionForWorkspaceChange: (workspaceId: string) => void
  removeWorkspaceState: (workspaceId: string) => void
}

type SidebarUIStore = SidebarUIState & SidebarUIActions
type SidebarUISet = StoreApi<SidebarUIStore>['setState']

function createDefaultWorkspaceSidebarState(): WorkspaceSidebarState {
  return {
    folderStates: {},
    bookmarksOnlyMode: false,
    closeAllFoldersMode: false,
    renamingId: null,
    selectedItemIds: [],
    anchorItemId: null,
    focusedItemId: null,
    selectionSurface: null,
    focusSurface: null,
    activeItemSurface: null,
  }
}

const initialSidebarUIState: SidebarUIState = {
  workspaceStates: {},
}

function getWorkspaceSidebarState(
  state: SidebarUIState,
  workspaceId: string,
): WorkspaceSidebarState {
  return normalizeWorkspaceSidebarState(state.workspaceStates[workspaceId])
}

function normalizeWorkspaceSidebarState(
  state: Partial<WorkspaceSidebarState> | undefined,
): WorkspaceSidebarState {
  return { ...createDefaultWorkspaceSidebarState(), ...state }
}

function updateWorkspaceSidebarState(
  state: SidebarUIState,
  workspaceId: string,
  updater: (prev: WorkspaceSidebarState) => Partial<WorkspaceSidebarState>,
): SidebarUIState | Partial<SidebarUIState> {
  const prev = getWorkspaceSidebarState(state, workspaceId)
  const patch = updater(prev)
  if (patch === prev) return state
  return {
    workspaceStates: {
      ...state.workspaceStates,
      [workspaceId]: { ...prev, ...patch },
    },
  }
}

function uniqueIds(ids: ReadonlyArray<SidebarItemId>): Array<SidebarItemId> {
  return Array.from(new Set(ids))
}

function surfaceIdentity(surface: ActiveItemSurface | null): ItemSurfaceIdentity | null {
  if (!surface) return null
  return { surface: surface.surface, parentId: surface.parentId }
}

function createSidebarEditingActions(set: SidebarUISet): Pick<SidebarUIActions, 'setRenamingId'> {
  return {
    setRenamingId: (workspaceId, id) =>
      set((state) => updateWorkspaceSidebarState(state, workspaceId, () => ({ renamingId: id }))),
  }
}

function createSidebarFolderActions(
  set: SidebarUISet,
): Pick<
  SidebarUIActions,
  | 'setFolderState'
  | 'toggleFolderState'
  | 'clearAllFolderStates'
  | 'toggleCloseAllFoldersMode'
  | 'exitCloseAllMode'
  | 'toggleBookmarksOnlyMode'
> {
  return {
    setFolderState: (workspaceId, folderId, isOpen) =>
      set((state) => {
        const prev = getWorkspaceSidebarState(state, workspaceId)
        const folderStates = { ...prev.folderStates }
        if (isOpen) {
          folderStates[folderId] = true
        } else {
          delete folderStates[folderId]
        }
        return updateWorkspaceSidebarState(state, workspaceId, () => ({ folderStates }))
      }),
    toggleFolderState: (workspaceId, folderId) =>
      set((state) => {
        const prev = getWorkspaceSidebarState(state, workspaceId)
        const folderStates = { ...prev.folderStates }
        if (folderStates[folderId]) {
          delete folderStates[folderId]
        } else {
          folderStates[folderId] = true
        }
        return updateWorkspaceSidebarState(state, workspaceId, () => ({ folderStates }))
      }),
    clearAllFolderStates: (workspaceId) =>
      set((state) => updateWorkspaceSidebarState(state, workspaceId, () => ({ folderStates: {} }))),
    toggleCloseAllFoldersMode: (workspaceId) =>
      set((state) => {
        const prev = getWorkspaceSidebarState(state, workspaceId)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          closeAllFoldersMode: !prev.closeAllFoldersMode,
        }))
      }),
    exitCloseAllMode: (workspaceId) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, () => ({ closeAllFoldersMode: false })),
      ),
    toggleBookmarksOnlyMode: (workspaceId) =>
      set((state) => {
        const prev = getWorkspaceSidebarState(state, workspaceId)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          bookmarksOnlyMode: !prev.bookmarksOnlyMode,
        }))
      }),
  }
}

function createSidebarDirectSelectionActions(
  set: SidebarUISet,
): Pick<SidebarUIActions, 'setSelectedItemIds' | 'selectSingleItem' | 'toggleItemSelection'> {
  return {
    setSelectedItemIds: (workspaceId, ids, anchorId) =>
      set((state) => {
        const workspaceState = getWorkspaceSidebarState(state, workspaceId)
        const selectedItemIds = uniqueIds(ids)
        const nextAnchor =
          anchorId === undefined
            ? (selectedItemIds[0] ?? null)
            : anchorId === null
              ? null
              : selectedItemIds.includes(anchorId)
                ? anchorId
                : (selectedItemIds[0] ?? null)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          selectedItemIds,
          anchorItemId: nextAnchor,
          focusedItemId: nextAnchor,
          selectionSurface: surfaceIdentity(workspaceState.activeItemSurface),
          focusSurface: nextAnchor ? surfaceIdentity(workspaceState.activeItemSurface) : null,
        }))
      }),
    selectSingleItem: (workspaceId, id) =>
      set((state) => {
        const workspaceState = getWorkspaceSidebarState(state, workspaceId)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          selectedItemIds: [id],
          anchorItemId: id,
          focusedItemId: id,
          selectionSurface: surfaceIdentity(workspaceState.activeItemSurface),
          focusSurface: surfaceIdentity(workspaceState.activeItemSurface),
        }))
      }),
    toggleItemSelection: (workspaceId, id) =>
      set((state) => {
        const workspaceState = getWorkspaceSidebarState(state, workspaceId)
        const isSelected = workspaceState.selectedItemIds.includes(id)
        const selectedItemIds = isSelected
          ? workspaceState.selectedItemIds.filter((selectedId) => selectedId !== id)
          : [...workspaceState.selectedItemIds, id]
        const anchorItemId =
          workspaceState.anchorItemId && selectedItemIds.includes(workspaceState.anchorItemId)
            ? workspaceState.anchorItemId
            : (selectedItemIds[0] ?? null)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          selectedItemIds,
          anchorItemId,
          focusedItemId: id,
          selectionSurface:
            selectedItemIds.length > 0 ? surfaceIdentity(workspaceState.activeItemSurface) : null,
          focusSurface: surfaceIdentity(workspaceState.activeItemSurface),
        }))
      }),
  }
}

function createSidebarRangeSelectionActions(
  set: SidebarUISet,
): Pick<SidebarUIActions, 'selectItemRange' | 'setFocusedItem' | 'moveFocus'> {
  return {
    selectItemRange: (workspaceId, targetId, visibleItemIds) =>
      set((state) => {
        const workspaceState = getWorkspaceSidebarState(state, workspaceId)
        const range = resolveFileSystemSelectionRange({
          anchorId: workspaceState.anchorItemId,
          fallbackAnchorId: workspaceState.focusedItemId,
          targetId,
          visibleItemIds,
        })
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          selectedItemIds: range.selectedItemIds,
          anchorItemId: range.anchorItemId,
          focusedItemId: targetId,
          selectionSurface: surfaceIdentity(workspaceState.activeItemSurface),
          focusSurface: surfaceIdentity(workspaceState.activeItemSurface),
        }))
      }),
    setFocusedItem: (workspaceId, id) =>
      set((state) => {
        const workspaceState = getWorkspaceSidebarState(state, workspaceId)
        return updateWorkspaceSidebarState(state, workspaceId, () => ({
          focusedItemId: id,
          focusSurface: id ? surfaceIdentity(workspaceState.activeItemSurface) : null,
        }))
      }),
    moveFocus: (workspaceId, direction, visibleItemIds, extendSelection) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, (workspaceState) =>
          moveSidebarFocusState(workspaceState, direction, visibleItemIds, extendSelection),
        ),
      ),
  }
}

function moveSidebarFocusState(
  state: WorkspaceSidebarState,
  direction: 'up' | 'down',
  visibleItemIds: ReadonlyArray<SidebarItemId>,
  extendSelection: boolean,
): Partial<WorkspaceSidebarState> {
  const focusedItemId = getNextFileSystemFocusedItemId(
    state.focusedItemId,
    direction,
    visibleItemIds,
  )
  if (!focusedItemId) {
    return { focusedItemId: null, focusSurface: null }
  }

  const focusSurface = surfaceIdentity(state.activeItemSurface)
  if (!extendSelection) {
    return {
      focusedItemId,
      focusSurface,
      selectedItemIds: [focusedItemId],
      anchorItemId: focusedItemId,
      selectionSurface: focusSurface,
    }
  }

  const range = resolveFileSystemSelectionRange({
    anchorId: state.anchorItemId,
    fallbackAnchorId: state.focusedItemId,
    targetId: focusedItemId,
    visibleItemIds,
  })
  return {
    focusedItemId,
    focusSurface,
    selectedItemIds: range.selectedItemIds,
    anchorItemId: range.anchorItemId,
    selectionSurface: focusSurface,
  }
}

function createSidebarSelectionSurfaceActions(
  set: SidebarUISet,
): Pick<
  SidebarUIActions,
  | 'clearItemSelection'
  | 'normalizeContextSelection'
  | 'setActiveItemSurface'
  | 'clearSelectionForWorkspaceChange'
> {
  return {
    clearItemSelection: (workspaceId) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, () => ({
          selectedItemIds: [],
          anchorItemId: null,
          selectionSurface: null,
        })),
      ),
    normalizeContextSelection: (workspaceId, id, visibleItemIds) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, (workspaceState) =>
          normalizeSidebarContextSelectionState(workspaceState, id, visibleItemIds),
        ),
      ),
    setActiveItemSurface: (workspaceId, surface) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, (workspaceState) =>
          setActiveSidebarItemSurfaceState(workspaceState, surface),
        ),
      ),
    clearSelectionForWorkspaceChange: (workspaceId) =>
      set((state) =>
        updateWorkspaceSidebarState(state, workspaceId, () => ({
          renamingId: null,
          selectedItemIds: [],
          anchorItemId: null,
          focusedItemId: null,
          selectionSurface: null,
          focusSurface: null,
          activeItemSurface: null,
          closeAllFoldersMode: false,
        })),
      ),
  }
}

function normalizeSidebarContextSelectionState(
  state: WorkspaceSidebarState,
  id: SidebarItemId,
  visibleItemIds?: ReadonlyArray<SidebarItemId>,
): Partial<WorkspaceSidebarState> | WorkspaceSidebarState {
  if (
    state.selectedItemIds.includes(id) &&
    (!visibleItemIds || selectionBelongsToSurface(state.selectedItemIds, visibleItemIds))
  ) {
    return state
  }
  return {
    selectedItemIds: [id],
    anchorItemId: id,
    focusedItemId: id,
    selectionSurface: surfaceIdentity(state.activeItemSurface),
    focusSurface: surfaceIdentity(state.activeItemSurface),
  }
}

function setActiveSidebarItemSurfaceState(
  state: WorkspaceSidebarState,
  surface: ActiveItemSurface | null,
): Partial<WorkspaceSidebarState> | WorkspaceSidebarState {
  const nextIdentity = surfaceIdentity(surface)
  if (sameItemSurfaceWithVisibleIds(state.activeItemSurface, surface)) return state
  if (!surface) {
    return {
      activeItemSurface: null,
      focusedItemId: null,
      focusSurface: null,
    }
  }

  const selectedIdsVisible =
    state.selectedItemIds.length > 0 &&
    selectionBelongsToSurface(state.selectedItemIds, surface.visibleItemIds)
  const selectedItemIds = selectedIdsVisible ? state.selectedItemIds : []
  const anchorItemId =
    selectedIdsVisible && state.anchorItemId && selectedItemIds.includes(state.anchorItemId)
      ? state.anchorItemId
      : (selectedItemIds[0] ?? null)
  const focusedItemId =
    state.focusedItemId && surface.visibleItemIds.includes(state.focusedItemId)
      ? state.focusedItemId
      : null
  const focusSurface = focusedItemId ? nextIdentity : null

  return {
    activeItemSurface: detachActiveItemSurface(surface),
    selectedItemIds,
    anchorItemId,
    focusedItemId,
    focusSurface,
    selectionSurface: selectedIdsVisible ? nextIdentity : null,
  }
}

function createSidebarUIActions(set: SidebarUISet): SidebarUIActions {
  return {
    ...createSidebarEditingActions(set),
    ...createSidebarFolderActions(set),
    ...createSidebarDirectSelectionActions(set),
    ...createSidebarRangeSelectionActions(set),
    ...createSidebarSelectionSurfaceActions(set),
    removeWorkspaceState: (workspaceId) =>
      set((state) => {
        if (!state.workspaceStates[workspaceId]) return state
        const workspaceStates = { ...state.workspaceStates }
        delete workspaceStates[workspaceId]
        return { workspaceStates }
      }),
  }
}

function toPersistedWorkspaceSidebarState(state: WorkspaceSidebarState) {
  const folderStates = Object.keys(state.folderStates).length > 0 ? state.folderStates : undefined
  const bookmarksOnlyMode = state.bookmarksOnlyMode ? state.bookmarksOnlyMode : undefined
  if (!folderStates && bookmarksOnlyMode === undefined) return null
  return {
    ...(folderStates ? { folderStates } : {}),
    ...(bookmarksOnlyMode === undefined ? {} : { bookmarksOnlyMode }),
  }
}

const useSidebarUIStore = create<SidebarUIStore>()(
  persist(
    (set) => ({
      ...initialSidebarUIState,
      ...createSidebarUIActions(set),
    }),
    {
      name: 'sidebar-ui',
      partialize: (state) => ({
        workspaceStates: Object.fromEntries(
          Object.entries(state.workspaceStates).flatMap(([workspaceId, workspaceState]) => {
            const persistedState = toPersistedWorkspaceSidebarState(workspaceState)
            return persistedState ? [[workspaceId, persistedState]] : []
          }),
        ),
      }),
    },
  ),
)

export function useClearSidebarWorkspaceStateOnUnmount(workspaceId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined
    return () => {
      useSidebarUIStore.getState().removeWorkspaceState(workspaceId)
    }
  }, [enabled, workspaceId])
}

const EMPTY_FOLDER_STATES: Record<SidebarItemId, boolean> = {}
const EMPTY_SELECTED_ITEM_IDS: ReadonlyArray<SidebarItemId> = []

function useWorkspaceSidebarState(workspaceId: string) {
  return useSidebarUIStore(
    useShallow((s) => {
      const workspaceState = s.workspaceStates[workspaceId]
      return {
        folderStates: workspaceState?.folderStates ?? EMPTY_FOLDER_STATES,
        closeAllFoldersMode: workspaceState?.closeAllFoldersMode ?? false,
        bookmarksOnlyMode: workspaceState?.bookmarksOnlyMode ?? false,
      }
    }),
  )
}

function createWorkspaceSidebarActions(workspaceId: string) {
  return {
    setFolderState: (folderId: SidebarItemId, isOpen: boolean) =>
      useSidebarUIStore.getState().setFolderState(workspaceId, folderId, isOpen),
    toggleFolderState: (folderId: SidebarItemId) =>
      useSidebarUIStore.getState().toggleFolderState(workspaceId, folderId),
    clearAllFolderStates: () => useSidebarUIStore.getState().clearAllFolderStates(workspaceId),
    toggleCloseAllFoldersMode: () =>
      useSidebarUIStore.getState().toggleCloseAllFoldersMode(workspaceId),
    exitCloseAllMode: () => useSidebarUIStore.getState().exitCloseAllMode(workspaceId),
    toggleBookmarksOnlyMode: () =>
      useSidebarUIStore.getState().toggleBookmarksOnlyMode(workspaceId),
  }
}

function useWorkspaceSidebarActions(workspaceId: string) {
  return useMemo(() => createWorkspaceSidebarActions(workspaceId), [workspaceId])
}

function useWorkspaceEditingState(workspaceId: string) {
  return useSidebarUIStore((s) => getWorkspaceSidebarState(s, workspaceId).renamingId)
}

function createWorkspaceEditingActions(workspaceId: string) {
  return {
    setRenamingItemId: (id: SidebarItemId | null) =>
      useSidebarUIStore.getState().setRenamingId(workspaceId, id),
  }
}

export function useStoredSidebarWorkspaceState({
  sort,
  workspaceId,
}: {
  sort: SidebarWorkspaceState['sort']
  workspaceId: string
}): SidebarWorkspaceState {
  const ui = useWorkspaceSidebarState(workspaceId)
  const uiCommands = useWorkspaceSidebarActions(workspaceId)
  const renamingItemId = useWorkspaceEditingState(workspaceId)
  const { setRenamingItemId } = useMemo(
    () => createWorkspaceEditingActions(workspaceId),
    [workspaceId],
  )
  const selection = useSidebarWorkspaceSelection(workspaceId)
  const selectionCommands = useSidebarWorkspaceSelectionCommands(workspaceId)

  const editing = useMemo(
    () => ({ renamingItemId, setRenamingItemId }),
    [renamingItemId, setRenamingItemId],
  )

  return useMemo(
    () => ({
      ui,
      uiCommands,
      sort,
      editing,
      selection,
      selectionCommands,
    }),
    [editing, selection, selectionCommands, sort, ui, uiCommands],
  )
}

export function useWorkspaceFileSystemOperationState(workspaceId: string) {
  const activeItemSurface = useSidebarUIStore(
    (s) => getWorkspaceSidebarState(s, workspaceId).activeItemSurface,
  )
  const selectionCommands = useSidebarWorkspaceSelectionCommands(workspaceId)
  const { setFolderState } = useMemo(
    () => createWorkspaceSidebarActions(workspaceId),
    [workspaceId],
  )

  return useMemo(
    () => ({
      activeItemSurface,
      selectionCommands: {
        clearItemSelection: selectionCommands.clearItemSelection,
        getSelectionSnapshot: selectionCommands.getSelectionSnapshot,
        setSelectedItemIds: selectionCommands.setSelectedItemIds,
      },
      uiCommands: {
        setFolderState,
      },
    }),
    [
      activeItemSurface,
      selectionCommands.clearItemSelection,
      selectionCommands.getSelectionSnapshot,
      selectionCommands.setSelectedItemIds,
      setFolderState,
    ],
  )
}

function useSidebarWorkspaceSelection(workspaceId: string) {
  return useSidebarUIStore(
    useShallow((s) => {
      const workspaceState = s.workspaceStates[workspaceId]
      return {
        selectedItemIds: workspaceState?.selectedItemIds ?? EMPTY_SELECTED_ITEM_IDS,
        focusedItemId: workspaceState?.focusedItemId ?? null,
        activeItemSurface: workspaceState?.activeItemSurface ?? null,
      }
    }),
  )
}

function useSidebarWorkspaceSelectionCommands(workspaceId: string) {
  const storeCommands = useSidebarUIStore(
    useShallow((s) => ({
      setSelectedItemIds: s.setSelectedItemIds,
      selectSingleItem: s.selectSingleItem,
      toggleItemSelection: s.toggleItemSelection,
      selectItemRange: s.selectItemRange,
      setFocusedItem: s.setFocusedItem,
      moveFocus: s.moveFocus,
      clearItemSelection: s.clearItemSelection,
      normalizeContextSelection: s.normalizeContextSelection,
      setActiveItemSurface: s.setActiveItemSurface,
      clearSelectionForWorkspaceChange: s.clearSelectionForWorkspaceChange,
    })),
  )
  return useMemo(
    () => ({
      setSelectedItemIds: (ids: ReadonlyArray<SidebarItemId>, anchorId?: SidebarItemId | null) =>
        storeCommands.setSelectedItemIds(workspaceId, ids, anchorId),
      selectSingleItem: (id: SidebarItemId) => storeCommands.selectSingleItem(workspaceId, id),
      toggleItemSelection: (id: SidebarItemId) =>
        storeCommands.toggleItemSelection(workspaceId, id),
      selectItemRange: (targetId: SidebarItemId, visibleItemIds: ReadonlyArray<SidebarItemId>) =>
        storeCommands.selectItemRange(workspaceId, targetId, visibleItemIds),
      setFocusedItem: (id: SidebarItemId | null) => storeCommands.setFocusedItem(workspaceId, id),
      moveFocus: (
        direction: 'up' | 'down',
        visibleItemIds: ReadonlyArray<SidebarItemId>,
        extendSelection: boolean,
      ) => storeCommands.moveFocus(workspaceId, direction, visibleItemIds, extendSelection),
      clearItemSelection: () => storeCommands.clearItemSelection(workspaceId),
      normalizeContextSelection: (
        id: SidebarItemId,
        visibleItemIds?: ReadonlyArray<SidebarItemId>,
      ) => storeCommands.normalizeContextSelection(workspaceId, id, visibleItemIds),
      setActiveItemSurface: (surface: ActiveItemSurface | null) =>
        storeCommands.setActiveItemSurface(workspaceId, surface),
      clearSelectionForWorkspaceChange: () =>
        storeCommands.clearSelectionForWorkspaceChange(workspaceId),
      getSelectionSnapshot: () => getSidebarWorkspaceSelectionSnapshot(workspaceId),
    }),
    [storeCommands, workspaceId],
  )
}

function getSidebarWorkspaceSelectionSnapshot(
  workspaceId: string,
): SidebarWorkspaceSelectionSnapshot {
  const state = useSidebarUIStore.getState()
  const workspaceState = getWorkspaceSidebarState(state, workspaceId)
  return {
    selectedItemIds: [...workspaceState.selectedItemIds],
    anchorItemId: workspaceState.anchorItemId,
    focusedItemId: workspaceState.focusedItemId,
    activeItemSurface: detachActiveItemSurface(workspaceState.activeItemSurface),
  }
}

function detachActiveItemSurface(surface: ActiveItemSurface | null): ActiveItemSurface | null {
  if (!surface) return null
  return {
    surface: surface.surface,
    parentId: surface.parentId,
    visibleItemIds: [...surface.visibleItemIds],
  }
}
