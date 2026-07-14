import type { SidebarItemId } from '../../../../shared/common/ids'
import type { CampaignMemberId } from '../resources/domain-id'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { ResourceAvailabilityState } from './domain/availability-state'
import { useResourceHydrationCache } from './resource-hydration-cache'
import type { ResourceHydrationEntry } from './resource-hydration-cache'
import { getNoteRenderState } from '../notes/render-state'
import type { NoteItemWithContent } from '../notes/item-contract'
import { isPersistedResourceItemId, isResourceItemWithContent } from '../workspace/items'
import type { AnyItem, AnyItemWithContent } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import { isTrashedSidebarItem } from '../workspace/items/status'
import type { CurrentItemState } from '../workspace/runtime'

export type ResourceContentState =
  | {
      status: 'unsupported'
      reason: Extract<ResourceContentSource, { status: 'unsupported' }>['reason']
      label: string
      item: undefined
      folderChildren: []
      isLoading: false
      error: null
    }
  | {
      status: 'idle'
      label: string
      item: undefined
      folderChildren: []
      isLoading: false
      error: null
    }
  | {
      status: 'loading'
      label: string
      item: undefined
      folderChildren: []
      isLoading: true
      error: null
    }
  | {
      status: 'ready'
      label: string
      item: AnyItemWithContent
      folderChildren: Array<AnyItem>
      isLoading: false
      error: null
    }
  | {
      status: 'unavailable'
      label: string
      item: undefined
      folderChildren: []
      isLoading: false
      error: null
      availabilityState: Exclude<ResourceAvailabilityState, { status: 'available' | 'loading' }>
    }
  | {
      status: 'not_found'
      label: string
      item: undefined
      folderChildren: []
      isLoading: false
      error: null
    }
  | {
      status: 'error'
      label: string
      item: undefined
      folderChildren: []
      isLoading: false
      error: unknown
    }

export type ResourceContentSource =
  | { status: 'unsupported'; reason: 'not_available' | 'not_implemented' }
  | {
      status: 'available'
      ensureContentState: (itemId: SidebarItemId | null | undefined) => void
      getContentState: (
        itemId: SidebarItemId | null | undefined,
        fallbackLabel?: string,
      ) => ResourceContentState
      resolveItem: (itemId: SidebarItemId) => AnyItem | null
    }

type ContentStateInput = {
  availabilityState?: CurrentItemState['availabilityState']
  error?: unknown
  fallbackLabel: string
  isLoading: boolean
  item: AnyItemWithContent | null | undefined
  itemId: SidebarItemId | null | undefined
}

type ResourceContentCatalog = {
  getKnownItemById: (itemId: SidebarItemId) => AnyItem | null
  getVisibleItemById: (itemId: SidebarItemId) => AnyItem | null
  queryVisibleItems: (input?: { parentId?: SidebarItemId | null }) => ReadonlyArray<AnyItem>
}

type ResourceContentProjection = {
  canAccessItem: (item: AnyItem, requiredLevel: PermissionLevel) => boolean
  getMemberItemPermissionLevel: (item: AnyItem, memberId: CampaignMemberId) => PermissionLevel
  viewAsPlayerId: CampaignMemberId | undefined
}

type CatalogResourceContentSourceInput = {
  catalog: ResourceContentCatalog
  current: CurrentItemState
  ensureContentState: (itemId: SidebarItemId | null | undefined) => void
  getContentState: (
    itemId: SidebarItemId | null | undefined,
    fallbackLabel?: string,
  ) => ResourceContentState
  contentProjection?: ResourceContentProjection
}

type StaticCatalogResourceContentSourceInput = {
  catalog: ResourceContentCatalog
  current: CurrentItemState
  contentProjection?: ResourceContentProjection
}

type HydratedCatalogResourceContentSourceInput<SourceId extends string> = {
  catalog: ResourceContentCatalog
  current: CurrentItemState
  loadItemContent: (itemId: SidebarItemId) => Promise<AnyItemWithContent | null>
  contentProjection?: ResourceContentProjection
  sourceId: SourceId | null | undefined
}

function createResourceContentState({
  availabilityState,
  error,
  fallbackLabel,
  isLoading,
  item,
  itemId,
}: ContentStateInput): ResourceContentState {
  if (!itemId) {
    return {
      status: 'idle',
      label: fallbackLabel,
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
    }
  }
  if (isLoading) {
    return {
      status: 'loading',
      label: availabilityState?.label ?? item?.name ?? fallbackLabel,
      item: undefined,
      folderChildren: [],
      isLoading: true,
      error: null,
    }
  }
  if (availabilityState && isUnavailableResourceAvailabilityState(availabilityState)) {
    return {
      status: 'unavailable',
      label: availabilityState.label,
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
      availabilityState,
    }
  }
  if (error !== null && error !== undefined) {
    return {
      status: 'error',
      label: availabilityState?.label ?? item?.name ?? fallbackLabel,
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error,
    }
  }
  if (!item) {
    return {
      status: 'not_found',
      label: availabilityState?.label ?? fallbackLabel,
      item: undefined,
      folderChildren: [],
      isLoading: false,
      error: null,
    }
  }
  return {
    status: 'ready',
    label: item.name,
    item,
    folderChildren: [],
    isLoading: false,
    error: null,
  }
}

function createCatalogFileSystemResourceContentSource({
  catalog,
  current,
  ensureContentState,
  getContentState,
  contentProjection,
}: CatalogResourceContentSourceInput): Extract<ResourceContentSource, { status: 'available' }> {
  return {
    status: 'available',
    ensureContentState: (itemId) => {
      if (current.item?.id === itemId || current.contentItem?.id === itemId) return
      if (!itemId || !catalog.getVisibleItemById(itemId)) return
      ensureContentState(itemId)
    },
    getContentState: (itemId, fallbackLabel) =>
      withVisibleFolderChildren({
        catalog,
        state: createCatalogResourceContentState({
          catalog,
          current,
          fallbackLabel,
          getContentState,
          itemId,
          contentProjection,
        }),
      }),
    resolveItem: catalog.getVisibleItemById,
  }
}

export function createStaticCatalogFileSystemResourceContentSource({
  catalog,
  current,
  contentProjection,
}: StaticCatalogResourceContentSourceInput): Extract<
  ResourceContentSource,
  { status: 'available' }
> {
  return createCatalogFileSystemResourceContentSource({
    catalog,
    current,
    ensureContentState: () => undefined,
    getContentState: (itemId, fallbackLabel) =>
      createStaticCatalogResourceContentState({ catalog, fallbackLabel, itemId }),
    contentProjection,
  })
}

export function useHydratedCatalogFileSystemResourceContentSource<SourceId extends string>({
  catalog,
  current,
  loadItemContent,
  contentProjection,
  sourceId,
}: HydratedCatalogResourceContentSourceInput<SourceId>): ResourceContentSource {
  const hydration = useResourceHydrationCache<SourceId, SidebarItemId, AnyItemWithContent | null>({
    load: loadItemContent,
  })

  return createCatalogFileSystemResourceContentSource({
    catalog,
    current,
    ensureContentState: (itemId) => {
      if (!isPersistedResourceItemId(itemId)) return
      hydration.ensure({ key: itemId, sourceId })
    },
    getContentState: (itemId, fallbackLabel) =>
      createHydratedResourceContentState({
        catalog,
        entry: isPersistedResourceItemId(itemId)
          ? hydration.getEntry({ key: itemId, sourceId })
          : undefined,
        fallbackLabel,
        itemId,
        sourceId,
      }),
    contentProjection,
  })
}

function createCatalogResourceContentState({
  catalog,
  current,
  fallbackLabel,
  getContentState,
  itemId,
  contentProjection,
}: {
  catalog: ResourceContentCatalog
  current: CurrentItemState
  fallbackLabel: string | undefined
  getContentState: (
    itemId: SidebarItemId | null | undefined,
    fallbackLabel?: string,
  ) => ResourceContentState
  itemId: SidebarItemId | null | undefined
  contentProjection: ResourceContentProjection | undefined
}): ResourceContentState {
  const label = getContentStateLabel({ catalog, fallbackLabel, itemId })
  if (current.item?.id === itemId || current.contentItem?.id === itemId) {
    return projectReadyResourceContentState(
      createResourceContentState({
        availabilityState: current.availabilityState,
        error: null,
        fallbackLabel: label,
        isLoading: current.availabilityState.status === 'loading',
        item: current.contentItem,
        itemId,
      }),
      contentProjection,
    )
  }

  const unavailableState = getCatalogUnavailableContentState({ catalog, itemId, label })
  if (unavailableState) return unavailableState

  return projectReadyResourceContentState(getContentState(itemId, label), contentProjection)
}

function createStaticCatalogResourceContentState({
  catalog,
  fallbackLabel,
  itemId,
}: {
  catalog: ResourceContentCatalog
  fallbackLabel: string | undefined
  itemId: SidebarItemId | null | undefined
}): ResourceContentState {
  const item = itemId ? catalog.getVisibleItemById(itemId) : null
  return createResourceContentState({
    fallbackLabel: getContentStateLabel({ catalog, fallbackLabel, itemId }),
    isLoading: false,
    item: isResourceItemWithContent(item) ? item : null,
    itemId,
  })
}

function createHydratedResourceContentState<SourceId extends string>({
  catalog,
  entry,
  fallbackLabel,
  itemId,
  sourceId,
}: {
  catalog: ResourceContentCatalog
  entry: ResourceHydrationEntry<SourceId, SidebarItemId, AnyItemWithContent | null> | undefined
  fallbackLabel: string | undefined
  itemId: SidebarItemId | null | undefined
  sourceId: SourceId | null | undefined
}) {
  const label = getContentStateLabel({ catalog, fallbackLabel, itemId })
  if (!itemId) {
    return createResourceContentState({
      fallbackLabel: label,
      itemId,
      item: null,
      isLoading: false,
    })
  }

  if (!sourceId || !isPersistedResourceItemId(itemId)) {
    return createResourceContentState({
      fallbackLabel: label,
      itemId,
      item: null,
      isLoading: false,
    })
  }

  if (!entry || entry.status === 'loading') {
    return createResourceContentState({ fallbackLabel: label, itemId, item: null, isLoading: true })
  }

  return createResourceContentState({
    error: entry.status === 'error' ? entry.error : null,
    fallbackLabel: label,
    isLoading: false,
    item: entry.status === 'success' ? entry.value : null,
    itemId,
  })
}

function withVisibleFolderChildren({
  catalog,
  state,
}: {
  catalog: ResourceContentCatalog
  state: ResourceContentState
}): ResourceContentState {
  if (state.status !== 'ready') return state
  return {
    ...state,
    folderChildren: [...catalog.queryVisibleItems({ parentId: state.item.id })],
  }
}

function projectReadyResourceContentState(
  state: ResourceContentState,
  projection: ResourceContentProjection | undefined,
): ResourceContentState {
  if (state.status !== 'ready') return state
  if (projection && !projection.canAccessItem(state.item, PERMISSION_LEVEL.VIEW)) {
    return unavailableContentState(
      'not_shared',
      state.item.name,
      projection.viewAsPlayerId
        ? "This item isn't shared with the selected player."
        : "This item isn't shared.",
    )
  }
  return {
    ...state,
    item: projectResourceContentItem(state.item, projection),
  }
}

function getCatalogUnavailableContentState({
  catalog,
  itemId,
  label,
}: {
  catalog: ResourceContentCatalog
  itemId: SidebarItemId | null | undefined
  label: string
}): ResourceContentState | null {
  if (!itemId) return null
  const knownItem = catalog.getKnownItemById(itemId)
  if (!knownItem || catalog.getVisibleItemById(itemId)) return null
  return isTrashedSidebarItem(knownItem)
    ? unavailableContentState('trashed', label, 'This item is in the trash.')
    : unavailableContentState('not_shared', label, "This item isn't shared.")
}

function unavailableContentState(
  status: 'trashed' | 'not_shared',
  label: string,
  message: string,
): ResourceContentState {
  return {
    status: 'unavailable',
    label,
    item: undefined,
    folderChildren: [],
    isLoading: false,
    error: null,
    availabilityState: { status, label, message },
  }
}

function projectResourceContentItem(
  item: AnyItemWithContent,
  projection: ResourceContentProjection | undefined,
): AnyItemWithContent {
  if (!projection || item.type !== RESOURCE_TYPES.notes) return item
  return projectNoteContentItem(item as NoteItemWithContent, projection)
}

function projectNoteContentItem(
  note: NoteItemWithContent,
  { canAccessItem, getMemberItemPermissionLevel, viewAsPlayerId }: ResourceContentProjection,
): NoteItemWithContent {
  const renderState = getNoteRenderState({
    canAccessItem,
    editable: false,
    getMemberItemPermissionLevel,
    note,
    viewAsPlayerId,
  })
  if (renderState.kind !== 'static' || renderState.content === note.content) return note

  return {
    ...note,
    content: renderState.content,
  }
}

function getContentStateLabel({
  catalog,
  fallbackLabel,
  itemId,
}: {
  catalog: ResourceContentCatalog
  fallbackLabel: string | undefined
  itemId: SidebarItemId | null | undefined
}) {
  if (!itemId) return fallbackLabel ?? 'Page'
  return catalog.getVisibleItemById(itemId)?.name ?? fallbackLabel ?? 'Page'
}

function isUnavailableResourceAvailabilityState(
  availabilityState: CurrentItemState['availabilityState'],
): availabilityState is Exclude<
  CurrentItemState['availabilityState'],
  { status: 'available' | 'loading' }
> {
  return availabilityState.status !== 'available' && availabilityState.status !== 'loading'
}
