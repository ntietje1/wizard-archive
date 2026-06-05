import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/shallow'
import type { CampaignViewAsSelection } from 'shared/campaigns/actor'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import { selectionBelongsToSurface } from 'shared/sidebar-items/filesystem/selection'

export type ItemSurface = 'sidebar' | 'folder-view' | 'bookmarks' | 'trash'

export interface ActiveItemSurface {
  surface: ItemSurface
  parentId: Id<'sidebarItems'> | null
  visibleItemIds: Array<Id<'sidebarItems'>>
}

interface ItemSurfaceIdentity {
  surface: ItemSurface
  parentId: Id<'sidebarItems'> | null
}

interface CampaignState {
  folderStates: Record<string, boolean>
  bookmarksOnlyMode: boolean
}

interface SidebarUIState {
  campaignStates: Record<string, CampaignState>
  renamingId: Id<'sidebarItems'> | null
  pendingItemName: string
  selectedSlug: SidebarItemSlug | null
  selectedItemIds: Array<Id<'sidebarItems'>>
  anchorItemId: Id<'sidebarItems'> | null
  focusedItemId: Id<'sidebarItems'> | null
  selectionSurface: ItemSurfaceIdentity | null
  focusSurface: ItemSurfaceIdentity | null
  activeItemSurface: ActiveItemSurface | null
  viewAsPlayer: CampaignViewAsSelection | null
}

interface SidebarUIActions {
  setRenamingId: (id: Id<'sidebarItems'> | null) => void
  setFolderState: (campaignId: string, folderId: string, isOpen: boolean) => void
  toggleFolderState: (campaignId: string, folderId: string) => void
  closeAllFolders: (campaignId: string) => void
  toggleBookmarksOnlyMode: (campaignId: string) => void
  setPendingItemName: (name: string) => void
  setSelected: (slug: SidebarItemSlug | null) => void
  setSelectedItemIds: (ids: Array<Id<'sidebarItems'>>, anchorId?: Id<'sidebarItems'> | null) => void
  selectSingleItem: (id: Id<'sidebarItems'>) => void
  toggleItemSelection: (id: Id<'sidebarItems'>) => void
  selectItemRange: (targetId: Id<'sidebarItems'>, visibleItemIds: Array<Id<'sidebarItems'>>) => void
  setFocusedItem: (id: Id<'sidebarItems'> | null) => void
  moveFocus: (
    direction: 'up' | 'down',
    visibleItemIds: Array<Id<'sidebarItems'>>,
    extendSelection: boolean,
  ) => void
  clearItemSelection: () => void
  normalizeContextSelection: (
    id: Id<'sidebarItems'>,
    visibleItemIds?: Array<Id<'sidebarItems'>>,
  ) => void
  setActiveItemSurface: (surface: ActiveItemSurface | null) => void
  clearSelectionForCampaignChange: () => void
  setViewAsPlayer: (state: CampaignViewAsSelection | null) => void
}

const defaultCampaignState: CampaignState = {
  folderStates: {},
  bookmarksOnlyMode: false,
}

function getCampaignState(state: SidebarUIState, campaignId: string): CampaignState {
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

function uniqueIds(ids: Array<Id<'sidebarItems'>>): Array<Id<'sidebarItems'>> {
  return Array.from(new Set(ids))
}

function selectRange(
  anchorId: Id<'sidebarItems'> | null,
  targetId: Id<'sidebarItems'>,
  visibleItemIds: Array<Id<'sidebarItems'>>,
): Array<Id<'sidebarItems'>> {
  const effectiveAnchor = anchorId ?? targetId
  const anchorIndex = visibleItemIds.indexOf(effectiveAnchor)
  const targetIndex = visibleItemIds.indexOf(targetId)

  if (anchorIndex === -1 || targetIndex === -1) {
    return [targetId]
  }

  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  return visibleItemIds.slice(start, end + 1)
}

function surfaceIdentity(surface: ActiveItemSurface | null): ItemSurfaceIdentity | null {
  if (!surface) return null
  return { surface: surface.surface, parentId: surface.parentId }
}

function sameVisibleIds(a: Array<Id<'sidebarItems'>>, b: Array<Id<'sidebarItems'>>) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function sameActiveItemSurface(a: ActiveItemSurface | null, b: ActiveItemSurface | null) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.surface === b.surface &&
    a.parentId === b.parentId &&
    sameVisibleIds(a.visibleItemIds, b.visibleItemIds)
  )
}

function nextFocusedId(
  currentId: Id<'sidebarItems'> | null,
  direction: 'up' | 'down',
  visibleItemIds: Array<Id<'sidebarItems'>>,
) {
  if (visibleItemIds.length === 0) return null
  const currentIndex = currentId ? visibleItemIds.indexOf(currentId) : -1
  if (currentIndex === -1) {
    return direction === 'up' ? visibleItemIds[visibleItemIds.length - 1] : visibleItemIds[0]
  }

  const nextIndex =
    direction === 'up'
      ? Math.max(0, currentIndex - 1)
      : Math.min(visibleItemIds.length - 1, currentIndex + 1)
  return visibleItemIds[nextIndex]
}

export const useSidebarUIStore = create<SidebarUIState & SidebarUIActions>()(
  persist(
    (set) => ({
      campaignStates: {},
      renamingId: null,
      pendingItemName: '',
      selectedSlug: null,
      selectedItemIds: [],
      anchorItemId: null,
      focusedItemId: null,
      selectionSurface: null,
      focusSurface: null,
      activeItemSurface: null,
      viewAsPlayer: null,

      setRenamingId: (id) => set({ renamingId: id }),

      setFolderState: (campaignId, folderId, isOpen) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          const folderStates = { ...prev.folderStates }
          if (isOpen) {
            folderStates[folderId] = true
          } else {
            delete folderStates[folderId]
          }
          return updateCampaignState(state, campaignId, () => ({ folderStates }))
        }),

      toggleFolderState: (campaignId, folderId) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          const folderStates = { ...prev.folderStates }
          if (folderStates[folderId]) {
            delete folderStates[folderId]
          } else {
            folderStates[folderId] = true
          }
          return updateCampaignState(state, campaignId, () => ({
            folderStates,
          }))
        }),

      closeAllFolders: (campaignId) =>
        set((state) =>
          updateCampaignState(state, campaignId, () => ({
            folderStates: {},
          })),
        ),

      toggleBookmarksOnlyMode: (campaignId) =>
        set((state) => {
          const prev = getCampaignState(state, campaignId)
          return updateCampaignState(state, campaignId, () => ({
            bookmarksOnlyMode: !prev.bookmarksOnlyMode,
          }))
        }),

      setPendingItemName: (name) => set({ pendingItemName: name }),

      setSelected: (slug) =>
        set((state) => {
          if (state.selectedSlug === slug) return state
          return {
            selectedSlug: slug,
          }
        }),

      setSelectedItemIds: (ids, anchorId) =>
        set((state) => {
          const selectedItemIds = uniqueIds(ids)
          const nextAnchor =
            anchorId === undefined
              ? (selectedItemIds[0] ?? null)
              : anchorId && selectedItemIds.includes(anchorId)
                ? anchorId
                : (selectedItemIds[0] ?? null)
          return {
            selectedItemIds,
            anchorItemId: nextAnchor,
            focusedItemId: nextAnchor,
            selectionSurface: surfaceIdentity(state.activeItemSurface),
            focusSurface: nextAnchor ? surfaceIdentity(state.activeItemSurface) : null,
          }
        }),

      selectSingleItem: (id) =>
        set((state) => ({
          selectedItemIds: [id],
          anchorItemId: id,
          focusedItemId: id,
          selectionSurface: surfaceIdentity(state.activeItemSurface),
          focusSurface: surfaceIdentity(state.activeItemSurface),
        })),

      toggleItemSelection: (id) =>
        set((state) => {
          const isSelected = state.selectedItemIds.includes(id)
          const selectedItemIds = isSelected
            ? state.selectedItemIds.filter((selectedId) => selectedId !== id)
            : [...state.selectedItemIds, id]

          const anchorItemId =
            state.anchorItemId && selectedItemIds.includes(state.anchorItemId)
              ? state.anchorItemId
              : (selectedItemIds[0] ?? null)

          return {
            selectedItemIds,
            anchorItemId,
            focusedItemId: id,
            selectionSurface:
              selectedItemIds.length > 0 ? surfaceIdentity(state.activeItemSurface) : null,
            focusSurface: surfaceIdentity(state.activeItemSurface),
          }
        }),

      selectItemRange: (targetId, visibleItemIds) =>
        set((state) => ({
          selectedItemIds: selectRange(state.anchorItemId, targetId, visibleItemIds),
          anchorItemId: state.anchorItemId ?? targetId,
          focusedItemId: targetId,
          selectionSurface: surfaceIdentity(state.activeItemSurface),
          focusSurface: surfaceIdentity(state.activeItemSurface),
        })),

      setFocusedItem: (id) =>
        set((state) => ({
          focusedItemId: id,
          focusSurface: id ? surfaceIdentity(state.activeItemSurface) : null,
        })),

      moveFocus: (direction, visibleItemIds, extendSelection) =>
        set((state) => {
          const focusedItemId = nextFocusedId(state.focusedItemId, direction, visibleItemIds)
          if (!focusedItemId) {
            return {
              focusedItemId: null,
              focusSurface: null,
            }
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

          const anchorItemId = state.anchorItemId ?? state.focusedItemId ?? focusedItemId
          return {
            focusedItemId,
            focusSurface,
            selectedItemIds: selectRange(anchorItemId, focusedItemId, visibleItemIds),
            anchorItemId,
            selectionSurface: focusSurface,
          }
        }),

      clearItemSelection: () =>
        set(() => ({
          selectedItemIds: [],
          anchorItemId: null,
          selectionSurface: null,
        })),

      normalizeContextSelection: (id, visibleItemIds) =>
        set((state) => {
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
        }),

      setActiveItemSurface: (surface) =>
        set((state) => {
          const nextIdentity = surfaceIdentity(surface)
          if (sameActiveItemSurface(state.activeItemSurface, surface)) return state
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
          const focusedItemId =
            state.focusedItemId && surface.visibleItemIds.includes(state.focusedItemId)
              ? state.focusedItemId
              : null
          const focusSurface = focusedItemId ? nextIdentity : null

          return {
            activeItemSurface: surface,
            focusedItemId,
            focusSurface,
            selectionSurface: selectedIdsVisible ? nextIdentity : state.selectionSurface,
          }
        }),

      clearSelectionForCampaignChange: () =>
        set({
          selectedItemIds: [],
          anchorItemId: null,
          focusedItemId: null,
          selectionSurface: null,
          focusSurface: null,
          activeItemSurface: null,
        }),

      setViewAsPlayer: (viewAsPlayer) => set({ viewAsPlayer }),
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
        bookmarksOnlyMode: cs?.bookmarksOnlyMode ?? false,
      }
    }),
  )
}

export function useCampaignSidebarActions(campaignId: string | undefined) {
  if (!campaignId) {
    const noop = () => {}
    return {
      setFolderState: noop as (folderId: string, isOpen: boolean) => void,
      toggleFolderState: noop as (folderId: string) => void,
      closeAllFolders: noop,
      toggleBookmarksOnlyMode: noop,
    }
  }
  return {
    setFolderState: (folderId: string, isOpen: boolean) =>
      useSidebarUIStore.getState().setFolderState(campaignId, folderId, isOpen),
    toggleFolderState: (folderId: string) =>
      useSidebarUIStore.getState().toggleFolderState(campaignId, folderId),
    closeAllFolders: () => useSidebarUIStore.getState().closeAllFolders(campaignId),
    toggleBookmarksOnlyMode: () => useSidebarUIStore.getState().toggleBookmarksOnlyMode(campaignId),
  }
}
