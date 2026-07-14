import type {
  WizardEditorEmbeddedCanvasState,
  WizardEditorItem,
  WizardEditorNoteCollaborationSessionRequest,
  WizardEditorResourceSlug,
  completeWizardEditorResourceCommand,
} from '@wizard-archive/editor/adapter'
import {
  parseWizardEditorResourceSlug,
  planWizardEditorMapPinCreations,
  WIZARD_EDITOR_RESOURCE_COMMAND_TYPE,
} from '@wizard-archive/editor/adapter'
import type { UserProfileId } from 'shared/common/ids'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import type { PermissionLevel } from 'shared/permissions/types'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  MapPinId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'

type LocalWorkspaceItemType = 'note' | 'folder' | 'canvas' | 'map' | 'file'
type LocalSidebarItemType = WizardEditorItem['type']
type LocalResourceColor = NonNullable<WizardEditorItem['color']>
type LocalResourceIconName = NonNullable<WizardEditorItem['iconName']>
export const LOCAL_WORKSPACE_INITIAL_TIMESTAMP = 1704067200000
const LOCAL_ITEM_TYPES_BY_SIDEBAR_TYPE = {
  note: 'note',
  folder: 'folder',
  canvas: 'canvas',
  gameMap: 'map',
  file: 'file',
} satisfies Record<LocalSidebarItemType, LocalWorkspaceItemType>

interface LocalWorkspaceItem {
  color?: LocalResourceColor
  createdAt: number
  id: ResourceId
  iconName?: LocalResourceIconName
  isBookmarked?: boolean
  parentId: ResourceId | null
  slug?: WizardEditorResourceSlug
  status: 'active' | 'trash'
  trashedAt?: number | null
  type: LocalWorkspaceItemType
  updatedAt: number
  title: string
  description: string
}

interface LocalItemCreation {
  id: ResourceId
  item: LocalWorkspaceItem
  nextLocalItemIndex: number
  slug: WizardEditorResourceSlug
}

interface LocalMapPin {
  id: MapPinId
  itemId: ResourceId
  layerId?: string | null
  x: number
  y: number
  visible: boolean
  creationTime: number
}

interface LocalMap {
  id: ResourceId
  imageUrl: string | null
  layers?: Array<LocalMapLayer>
  pins: Array<LocalMapPin>
}

interface LocalMapLayer {
  id: string
  imageUrl: string | null
  name: string
}

interface LocalMapPinCreation {
  id: MapPinId
  itemId: ResourceId
  layerId?: string | null
  x: number
  y: number
  visible: boolean
  creationTime: number
}

interface LocalWorkspaceUser {
  color: string
  id: UserProfileId
  name: string
}

type LocalNote = WizardEditorNoteCollaborationSessionRequest['note']
type LocalNoteBlock = LocalNote['content'][number]
type LocalNoteBlockMeta = LocalNote['blockMeta'][string]

interface LocalNoteBlockVisibilityRule extends Partial<
  Pick<LocalNoteBlockMeta, 'hiddenFrom' | 'myPermissionLevel' | 'shareStatus' | 'sharedWith'>
> {
  textIncludes: string
}

export interface LocalWorkspaceState {
  localUser: LocalWorkspaceUser
  workspaceId: CampaignId
  nextLocalItemIndex: number
  items: Array<LocalWorkspaceItem>
  memberItemPermissionsById?: Record<string, Partial<Record<CampaignMemberId, PermissionLevel>>>
  noteBlockVisibilityById?: Record<string, Array<LocalNoteBlockVisibilityRule>>
  noteAdditionalBlocksById: Record<string, Array<LocalNoteBlock>>
  noteBodiesById: Record<string, string>
  canvasPayloadsById: Record<string, LocalCanvasPayload>
  filePayloadsById: Record<string, LocalFilePayload>
  mapsById: Record<string, LocalMap>
  playerMembers?: Array<CampaignMemberSummary>
  selectedViewAsPlayerId?: CampaignMemberId
}

function getValidLocalViewAsPlayerId(
  state: Pick<LocalWorkspaceState, 'playerMembers' | 'selectedViewAsPlayerId'>,
): CampaignMemberId | undefined {
  const selectedPlayerId = state.selectedViewAsPlayerId
  if (!selectedPlayerId) return undefined
  if (!state.playerMembers) return selectedPlayerId

  return state.playerMembers.some((member) => member.id === selectedPlayerId)
    ? selectedPlayerId
    : undefined
}

export function withValidLocalViewAsPlayerSelection(
  state: LocalWorkspaceState,
): LocalWorkspaceState {
  const selectedViewAsPlayerId = getValidLocalViewAsPlayerId(state)
  return selectedViewAsPlayerId === state.selectedViewAsPlayerId
    ? state
    : { ...state, selectedViewAsPlayerId }
}

type LocalAvailableCanvasPayload = Extract<WizardEditorEmbeddedCanvasState, { status: 'available' }>
type LocalCanvasPayload = Pick<LocalAvailableCanvasPayload, 'edges' | 'nodes'>
type LocalResourceCommandReceipt = Extract<
  ReturnType<typeof completeWizardEditorResourceCommand>,
  { status: 'completed' }
>['receipt']

export type LocalFilePayload = {
  allowDataUrl: true
  allowObjectUrl: false
  contentType: string
  downloadUrl: string
  name: string
  size: number
  status: 'available'
}

export function requireLocalCanvasPayload(
  state: LocalWorkspaceState,
  canvasId: ResourceId,
): LocalCanvasPayload {
  const payload = state.canvasPayloadsById[canvasId]
  if (!payload) {
    throw new Error(`Missing local canvas payload for ${canvasId}`)
  }
  return payload
}

export function requireLocalFilePayloadForItem(
  state: LocalWorkspaceState,
  item: Pick<LocalWorkspaceItem, 'id' | 'title'>,
): LocalFilePayload {
  const payload = state.filePayloadsById[item.id]
  if (!payload) {
    throw new Error(`Missing local file payload for ${item.id}`)
  }
  return payload
}

function requireLocalMap(state: LocalWorkspaceState, mapId: ResourceId): LocalMap {
  const map = state.mapsById[mapId]
  if (!map) {
    throw new Error(`Missing local map payload for ${mapId}`)
  }
  return map
}

export type LocalWorkspaceAction =
  | { type: 'applyResourceCommandReceipt'; receipt: LocalResourceCommandReceipt }
  | {
      type: 'createMapPins'
      mapId: ResourceId
      pins: Array<LocalMapPinCreation>
    }
  | { type: 'createItem'; creation: LocalItemCreation }
  | { type: 'deleteItemsForever'; itemIds: Array<ResourceId> }
  | { type: 'moveItems'; itemIds: Array<ResourceId>; targetParentId: ResourceId | null }
  | { type: 'replaceCanvasPayload'; itemId: ResourceId; payload: LocalCanvasPayload }
  | { type: 'replaceNoteBody'; itemId: ResourceId; body: string }
  | { type: 'restoreItems'; itemIds: Array<ResourceId>; targetParentId: ResourceId | null }
  | { type: 'trashItems'; itemIds: Array<ResourceId> }
  | { type: 'toggleBookmarks'; itemIds: Array<ResourceId> }
  | {
      type: 'updateItemMetadata'
      itemId: ResourceId
      title?: string
      slug?: WizardEditorResourceSlug
      iconName?: LocalResourceIconName | null
      color?: LocalResourceColor | null
    }
  | { type: 'replaceFile'; itemId: ResourceId; payload: LocalFilePayload }
  | { type: 'removeMapPin'; mapPinId: MapPinId }
  | { type: 'updateMapImage'; layerId: string | null; mapId: ResourceId; imageUrl: string | null }
  | { type: 'updateMapPin'; mapPinId: MapPinId; x: number; y: number }
  | { type: 'updateMapPinVisibility'; mapPinId: MapPinId; isVisible: boolean }

type LocalWorkspaceReducerMap = {
  [Type in LocalWorkspaceAction['type']]: (
    state: LocalWorkspaceState,
    action: Extract<LocalWorkspaceAction, { type: Type }>,
  ) => LocalWorkspaceState
}

export function localWorkspaceReducer(
  state: LocalWorkspaceState,
  action: LocalWorkspaceAction,
): LocalWorkspaceState {
  const reduce = localWorkspaceReducers[action.type] as (
    state: LocalWorkspaceState,
    action: LocalWorkspaceAction,
  ) => LocalWorkspaceState
  return reduce(state, action)
}

const localWorkspaceReducers = {
  applyResourceCommandReceipt: (state, action) =>
    applyResourceCommandReceipt(state, action.receipt),
  createMapPins,
  createItem: (state, action) => applyLocalItemCreation(state, action.creation),
  deleteItemsForever: (state, action) => deleteItemsForever(state, action.itemIds),
  moveItems: (state, action) => moveItems(state, action.itemIds, action.targetParentId),
  replaceCanvasPayload: (state, action) =>
    replaceCanvasPayload(state, action.itemId, action.payload),
  replaceFile: (state, action) => replaceFile(state, action.itemId, action.payload),
  replaceNoteBody: (state, action) => replaceNoteBody(state, action.itemId, action.body),
  restoreItems: (state, action) => restoreItems(state, action.itemIds, action.targetParentId),
  trashItems: (state, action) => trashItems(state, action.itemIds),
  toggleBookmarks: (state, action) => toggleBookmarks(state, action.itemIds),
  updateItemMetadata,
  removeMapPin: (state, action) => removeMapPin(state, action.mapPinId),
  updateMapImage: (state, action) =>
    updateMapImage(state, action.mapId, action.layerId, action.imageUrl),
  updateMapPin: (state, action) => updateMapPin(state, action.mapPinId, action.x, action.y),
  updateMapPinVisibility: (state, action) =>
    updateMapPinVisibility(state, action.mapPinId, action.isVisible),
} satisfies LocalWorkspaceReducerMap

function applyResourceCommandReceipt(
  state: LocalWorkspaceState,
  receipt: LocalResourceCommandReceipt,
): LocalWorkspaceState {
  if (receipt.events.length === 0) return state

  const itemIds = receipt.events.flatMap((event) => ('itemId' in event ? [event.itemId] : []))

  switch (receipt.command.type) {
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.move:
      return moveItems(state, itemIds, receipt.command.targetParentId)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.copy:
      return copyItemsFromReceipt(
        state,
        receipt.command.itemIds,
        receipt.command.targetParentId,
        new Map(
          receipt.events.flatMap((event) =>
            event.type === 'copied' ? [[event.sourceItemId, event.itemId]] : [],
          ),
        ),
      )
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.trash:
      return trashItems(state, itemIds)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.restore:
      return restoreItems(state, itemIds, receipt.command.targetParentId)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.deleteForever:
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.emptyTrash:
      return deleteItemsForever(state, itemIds)
    case WIZARD_EDITOR_RESOURCE_COMMAND_TYPE.toggleBookmarks:
      return toggleBookmarks(state, itemIds)
    default:
      return state
  }
}

function createLocalWorkspaceMutationTimestamp() {
  return Date.now()
}

function markLocalItemsUpdated(
  items: Array<LocalWorkspaceItem>,
  itemIds: ReadonlySet<ResourceId>,
  updatedAt: number,
) {
  return items.map((item) => (itemIds.has(item.id) ? { ...item, updatedAt } : item))
}

function updateItemMetadata(
  state: LocalWorkspaceState,
  action: Extract<LocalWorkspaceAction, { type: 'updateItemMetadata' }>,
): LocalWorkspaceState {
  const nextTitle = action.title === undefined ? undefined : action.title.trim()
  const item = state.items.find((candidate) => candidate.id === action.itemId)
  if (!item) return state
  const nextItem = {
    ...item,
    ...(nextTitle === undefined ? {} : { title: nextTitle }),
    ...(action.slug === undefined ? {} : { slug: action.slug }),
    ...(action.iconName === undefined ? {} : { iconName: action.iconName ?? undefined }),
    ...(action.color === undefined ? {} : { color: action.color ?? undefined }),
  }
  if (
    nextItem.title === item.title &&
    nextItem.slug === item.slug &&
    nextItem.iconName === item.iconName &&
    nextItem.color === item.color
  ) {
    return state
  }

  const updatedAt = createLocalWorkspaceMutationTimestamp()
  const items = state.items.map((candidate) =>
    candidate.id === item.id ? { ...nextItem, updatedAt } : candidate,
  )
  return { ...state, items }
}

function replaceFile(
  state: LocalWorkspaceState,
  itemId: ResourceId,
  payload: LocalFilePayload,
): LocalWorkspaceState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item || item.type !== 'file') return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()

  return {
    ...state,
    filePayloadsById: {
      ...state.filePayloadsById,
      [itemId]: payload,
    },
    items: markLocalItemsUpdated(state.items, new Set([itemId]), updatedAt),
  }
}

function replaceCanvasPayload(
  state: LocalWorkspaceState,
  itemId: ResourceId,
  payload: LocalCanvasPayload,
): LocalWorkspaceState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item || item.type !== 'canvas') return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()

  return {
    ...state,
    canvasPayloadsById: {
      ...state.canvasPayloadsById,
      [itemId]: payload,
    },
    items: markLocalItemsUpdated(state.items, new Set([itemId]), updatedAt),
  }
}

function replaceNoteBody(
  state: LocalWorkspaceState,
  itemId: ResourceId,
  body: string,
): LocalWorkspaceState {
  const item = state.items.find((candidate) => candidate.id === itemId)
  if (!item || item.type !== 'note') return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()

  return {
    ...state,
    noteBodiesById: {
      ...state.noteBodiesById,
      [itemId]: body,
    },
    items: markLocalItemsUpdated(state.items, new Set([itemId]), updatedAt),
  }
}

function createMapPins(
  state: LocalWorkspaceState,
  action: Extract<LocalWorkspaceAction, { type: 'createMapPins' }>,
): LocalWorkspaceState {
  const map = state.mapsById[action.mapId]
  if (!map || action.pins.length === 0) return state

  const activeItemIds = new Set<ResourceId>()
  for (const item of state.items) {
    if (item.status === 'active') activeItemIds.add(item.id)
  }
  const pins = action.pins
  const pinsByItemId = new Map(pins.map((pin) => [pin.itemId, pin] as const))
  const createdPins = planWizardEditorMapPinCreations({
    mapId: action.mapId,
    existingPinnedItemIds: map.pins.map((pin) => pin.itemId),
    pins,
    canPinItem: (itemId) => activeItemIds.has(itemId),
    createPin: (pin): LocalMapPinCreation => pinsByItemId.get(pin.itemId)!,
  })
  if (createdPins.length === 0) return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()

  return {
    ...state,
    items: markLocalItemsUpdated(state.items, new Set([action.mapId]), updatedAt),
    mapsById: {
      ...state.mapsById,
      [action.mapId]: { ...map, pins: [...map.pins, ...createdPins] },
    },
  }
}

function updateMapPin(
  state: LocalWorkspaceState,
  mapPinId: MapPinId,
  x: number,
  y: number,
): LocalWorkspaceState {
  const updated = updateMapContainingPin(state, mapPinId, (map) => ({
    ...map,
    pins: map.pins.map((pin) =>
      pin.id === mapPinId && (pin.x !== x || pin.y !== y) ? { ...pin, x, y } : pin,
    ),
  }))
  return updated.mapsById === state.mapsById
    ? state
    : withUpdatedLocalMap(state, updated.mapId, updated.mapsById)
}

function updateMapPinVisibility(
  state: LocalWorkspaceState,
  mapPinId: MapPinId,
  isVisible: boolean,
): LocalWorkspaceState {
  const updated = updateMapContainingPin(state, mapPinId, (map) => ({
    ...map,
    pins: map.pins.map((pin) =>
      pin.id === mapPinId && pin.visible !== isVisible ? { ...pin, visible: isVisible } : pin,
    ),
  }))
  return updated.mapsById === state.mapsById
    ? state
    : withUpdatedLocalMap(state, updated.mapId, updated.mapsById)
}

function removeMapPin(state: LocalWorkspaceState, mapPinId: MapPinId): LocalWorkspaceState {
  const updated = updateMapContainingPin(state, mapPinId, (map) => ({
    ...map,
    pins: map.pins.filter((pin) => pin.id !== mapPinId),
  }))
  return updated.mapsById === state.mapsById
    ? state
    : withUpdatedLocalMap(state, updated.mapId, updated.mapsById)
}

function updateMapImage(
  state: LocalWorkspaceState,
  mapId: ResourceId,
  layerId: string | null,
  imageUrl: string | null,
): LocalWorkspaceState {
  const map = state.mapsById[mapId]
  if (!map) return state
  const layerIndex = layerId === null ? 0 : map.layers?.findIndex((layer) => layer.id === layerId)
  if (layerId !== null && (layerIndex === undefined || layerIndex < 0)) return state
  if (
    layerId === null &&
    map.imageUrl === imageUrl &&
    (!map.layers?.length || map.layers[0]?.imageUrl === imageUrl)
  ) {
    return state
  }
  const layers = map.layers?.length
    ? map.layers.map((layer, index) => (index === layerIndex ? { ...layer, imageUrl } : layer))
    : map.layers
  return withUpdatedLocalMap(state, mapId, {
    ...state.mapsById,
    [mapId]: { ...map, imageUrl: layerId === null ? imageUrl : map.imageUrl, layers },
  })
}

function updateMapContainingPin(
  state: LocalWorkspaceState,
  mapPinId: MapPinId,
  update: (map: LocalMap) => LocalMap,
) {
  const mapEntry = Object.entries(state.mapsById).find(([, map]) =>
    map.pins.some((pin) => pin.id === mapPinId),
  )
  if (!mapEntry) return { mapId: null, mapsById: state.mapsById }
  const [, map] = mapEntry
  const nextMap = update(map)
  if (nextMap === map || mapsAreEqual(nextMap, map)) {
    return { mapId: null, mapsById: state.mapsById }
  }
  return {
    mapId: map.id,
    mapsById: {
      ...state.mapsById,
      [map.id]: nextMap,
    },
  }
}

function mapsAreEqual(left: LocalMap, right: LocalMap) {
  if (left.id !== right.id || left.imageUrl !== right.imageUrl || left.layers !== right.layers) {
    return false
  }
  if (left.pins.length !== right.pins.length) return false
  return left.pins.every((pin, index) => pin === right.pins[index])
}

function withUpdatedLocalMap(
  state: LocalWorkspaceState,
  mapId: ResourceId | null,
  mapsById: Record<string, LocalMap>,
): LocalWorkspaceState {
  if (!mapId) return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()
  return {
    ...state,
    items: markLocalItemsUpdated(state.items, new Set([mapId]), updatedAt),
    mapsById,
  }
}

function moveItems(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  targetParentId: ResourceId | null,
): LocalWorkspaceState {
  if (!isValidLocalParentTarget(state, targetParentId)) return state
  const rootIds = normalizedRootIds(state, itemIds, { status: 'active' })
  const movingIds = new Set(rootIds)
  const descendantIds = new Set(rootIds.flatMap((id) => descendantItemIds(state, id)))
  if (targetParentId && (movingIds.has(targetParentId) || descendantIds.has(targetParentId))) {
    return state
  }
  const updatedAt = createLocalWorkspaceMutationTimestamp()

  let changed = false
  const items = state.items.map((item) => {
    if (!movingIds.has(item.id) || item.parentId === targetParentId) return item
    changed = true
    return { ...item, parentId: targetParentId, updatedAt }
  })
  return changed ? { ...state, items } : state
}

function copyItemsFromReceipt(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  targetParentId: ResourceId | null,
  copiedItemIdsBySourceId: ReadonlyMap<ResourceId, ResourceId>,
): LocalWorkspaceState {
  if (!isValidLocalParentTarget(state, targetParentId)) return state
  const rootIds = normalizedRootIds(state, itemIds, { status: 'active' })
  if (rootIds.length === 0) return state

  let nextIndex = state.nextLocalItemIndex
  const copiedItems: Array<LocalWorkspaceItem> = []
  const copiedCanvasPayloads = { ...state.canvasPayloadsById }
  const copiedFilePayloads = { ...state.filePayloadsById }
  const copiedMapsById = { ...state.mapsById }
  const copiedMapIds: Array<ResourceId> = []
  const copiedNoteAdditionalBlocks = { ...state.noteAdditionalBlocksById }
  const copiedNoteBlockVisibilityRef: {
    value: LocalWorkspaceState['noteBlockVisibilityById']
  } = {
    value: state.noteBlockVisibilityById ? { ...state.noteBlockVisibilityById } : undefined,
  }
  const copiedNoteBodies = { ...state.noteBodiesById }
  const idMap = new Map<ResourceId, ResourceId>()
  const itemsById = new Map(state.items.map((item) => [item.id, item] as const))
  const nextIndexRef = { value: nextIndex }
  const copiedAt = createLocalWorkspaceMutationTimestamp()

  for (const rootId of rootIds) {
    const root = itemsById.get(rootId)
    if (!root) continue
    copyItemTree({
      copiedItems,
      copiedCanvasPayloads,
      copiedFilePayloads,
      copiedMapIds,
      copiedMapsById,
      copiedNoteAdditionalBlocks,
      copiedNoteBlockVisibilityRef,
      copiedNoteBodies,
      copiedItemIdsBySourceId,
      idMap,
      nextIndexRef,
      sourceParentId: root.parentId,
      state,
      targetParentId,
      item: root,
      copiedAt,
    })
  }
  nextIndex = nextIndexRef.value

  if (copiedItems.length === 0) return state
  for (const copiedMapId of copiedMapIds) {
    copiedMapsById[copiedMapId] = remapLocalMapPins(copiedMapsById[copiedMapId]!, idMap)
  }
  const copiedMemberItemPermissionsById = copyMemberItemPermissions(
    state.memberItemPermissionsById,
    idMap,
  )
  return {
    ...state,
    canvasPayloadsById: copiedCanvasPayloads,
    filePayloadsById: copiedFilePayloads,
    items: [...state.items, ...copiedItems],
    mapsById: copiedMapsById,
    memberItemPermissionsById: copiedMemberItemPermissionsById,
    nextLocalItemIndex: nextIndex,
    noteAdditionalBlocksById: copiedNoteAdditionalBlocks,
    noteBlockVisibilityById: copiedNoteBlockVisibilityRef.value,
    noteBodiesById: copiedNoteBodies,
  }
}

function trashItems(state: LocalWorkspaceState, itemIds: Array<ResourceId>): LocalWorkspaceState {
  const affectedIds = itemIdsWithDescendants(state, itemIds, {
    descendantStatus: 'active',
    rootStatus: 'active',
  })
  if (affectedIds.size === 0) return state
  const updatedAt = createLocalWorkspaceMutationTimestamp()
  const items = state.items.map((item) =>
    affectedIds.has(item.id)
      ? { ...item, status: 'trash' as const, trashedAt: updatedAt, updatedAt }
      : item,
  )
  return { ...state, items }
}

function toggleBookmarks(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
): LocalWorkspaceState {
  const ids = new Set(itemIds)
  if (ids.size === 0) return state

  let changed = false
  const updatedAt = createLocalWorkspaceMutationTimestamp()
  const items = state.items.map((item) => {
    if (!ids.has(item.id) || item.status !== 'active') return item
    changed = true
    return { ...item, isBookmarked: !item.isBookmarked, updatedAt }
  })

  return changed ? { ...state, items } : state
}

function restoreItems(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  targetParentId: ResourceId | null,
): LocalWorkspaceState {
  if (!isValidLocalParentTarget(state, targetParentId)) return state
  const rootIds = normalizedRootIds(state, itemIds, { status: 'trash' })
  const affectedIds = itemIdsWithDescendants(state, rootIds, {
    descendantStatus: 'trash',
    rootStatus: 'trash',
  })
  if (affectedIds.size === 0) return state
  const rootIdSet = new Set(rootIds)
  const updatedAt = createLocalWorkspaceMutationTimestamp()
  const items = state.items.map((item) => {
    if (!affectedIds.has(item.id)) return item
    return {
      ...item,
      parentId: rootIdSet.has(item.id) ? targetParentId : item.parentId,
      status: 'active' as const,
      trashedAt: null,
      updatedAt,
    }
  })
  return { ...state, items }
}

function deleteItemsForever(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
): LocalWorkspaceState {
  const affectedIds = itemIdsWithDescendants(state, itemIds, {
    descendantStatus: 'trash',
    rootStatus: 'trash',
  })
  if (affectedIds.size === 0) return state
  const items = state.items.filter((item) => !affectedIds.has(item.id))
  const canvasPayloadsById = { ...state.canvasPayloadsById }
  const filePayloadsById = { ...state.filePayloadsById }
  const noteAdditionalBlocksById = { ...state.noteAdditionalBlocksById }
  const noteBlockVisibilityById = state.noteBlockVisibilityById
    ? { ...state.noteBlockVisibilityById }
    : undefined
  const noteBodiesById = { ...state.noteBodiesById }
  const memberItemPermissionsById = removeMemberItemPermissionsForItems(
    state.memberItemPermissionsById,
    affectedIds,
  )
  const mapsById = removeMapContentForItems(state.mapsById, affectedIds)
  for (const id of affectedIds) {
    delete canvasPayloadsById[id]
    delete filePayloadsById[id]
    delete noteAdditionalBlocksById[id]
    if (noteBlockVisibilityById) delete noteBlockVisibilityById[id]
    delete noteBodiesById[id]
  }
  return {
    ...state,
    canvasPayloadsById,
    filePayloadsById,
    items,
    mapsById,
    memberItemPermissionsById,
    noteAdditionalBlocksById,
    noteBlockVisibilityById,
    noteBodiesById,
  }
}

function copyItemTree({
  copiedAt,
  copiedItems,
  copiedCanvasPayloads,
  copiedFilePayloads,
  copiedMapIds,
  copiedMapsById,
  copiedNoteAdditionalBlocks,
  copiedNoteBlockVisibilityRef,
  copiedNoteBodies,
  copiedItemIdsBySourceId,
  idMap,
  item,
  nextIndexRef,
  sourceParentId,
  state,
  targetParentId,
}: {
  copiedAt: number
  copiedItems: Array<LocalWorkspaceItem>
  copiedCanvasPayloads: Record<string, LocalCanvasPayload>
  copiedFilePayloads: Record<string, LocalFilePayload>
  copiedMapIds: Array<ResourceId>
  copiedMapsById: Record<string, LocalMap>
  copiedNoteAdditionalBlocks: Record<string, Array<LocalNoteBlock>>
  copiedNoteBlockVisibilityRef: {
    value: LocalWorkspaceState['noteBlockVisibilityById']
  }
  copiedNoteBodies: Record<string, string>
  copiedItemIdsBySourceId: ReadonlyMap<ResourceId, ResourceId>
  idMap: Map<ResourceId, ResourceId>
  item: LocalWorkspaceItem
  nextIndexRef: { value: number }
  sourceParentId: ResourceId | null
  state: LocalWorkspaceState
  targetParentId: ResourceId | null
}) {
  const copiedId = copiedItemIdsBySourceId.get(item.id)
  if (!copiedId) {
    throw new Error(`Copy receipt is missing a copied id for ${item.id}`)
  }
  nextIndexRef.value += 1
  idMap.set(item.id, copiedId)
  const copiedParentId =
    item.parentId === sourceParentId
      ? targetParentId
      : item.parentId
        ? (idMap.get(item.parentId) ?? null)
        : null
  const copiedItem: LocalWorkspaceItem = {
    ...item,
    createdAt: copiedAt,
    id: copiedId,
    parentId: copiedParentId,
    slug: requireLocalResourceSlug(copiedId),
    status: 'active',
    trashedAt: null,
    title: item.title || localItemTitle(item.type),
    updatedAt: copiedAt,
  }
  copiedItems.push(copiedItem)

  if (item.type === 'note') {
    copiedNoteBodies[copiedId] = state.noteBodiesById[item.id] ?? ''
    copiedNoteAdditionalBlocks[copiedId] = (state.noteAdditionalBlocksById[item.id] ?? []).map(
      (block) => structuredClone(block),
    )
    const visibilityRules = state.noteBlockVisibilityById?.[item.id]
    if (visibilityRules) {
      copiedNoteBlockVisibilityRef.value = {
        ...copiedNoteBlockVisibilityRef.value,
        [copiedId]: structuredClone(visibilityRules),
      }
    }
  }
  if (item.type === 'canvas') {
    copiedCanvasPayloads[copiedId] = copyLocalCanvasPayload(state, item.id)
  }
  if (item.type === 'file') {
    copiedFilePayloads[copiedId] = requireLocalFilePayloadForItem(state, item)
  }
  if (item.type === 'map') {
    copiedMapsById[copiedId] = copyLocalMap(state, item.id, copiedId)
    copiedMapIds.push(copiedId)
  }

  for (const child of childrenOf(state, item.id, 'active')) {
    copyItemTree({
      copiedItems,
      copiedCanvasPayloads,
      copiedFilePayloads,
      copiedMapIds,
      copiedMapsById,
      copiedNoteAdditionalBlocks,
      copiedNoteBlockVisibilityRef,
      copiedNoteBodies,
      copiedItemIdsBySourceId,
      idMap,
      item: child,
      nextIndexRef,
      sourceParentId,
      state,
      targetParentId,
      copiedAt,
    })
  }
}

function copyLocalCanvasPayload(
  state: LocalWorkspaceState,
  sourceCanvasId: ResourceId,
): LocalCanvasPayload {
  const sourceCanvas = requireLocalCanvasPayload(state, sourceCanvasId)
  const nodeIdMap = new Map(
    sourceCanvas.nodes.map(
      (node) => [node.id, generateDomainId(DOMAIN_ID_KIND.canvasNode)] as const,
    ),
  )
  return {
    edges: sourceCanvas.edges.flatMap((edge) => {
      const source = nodeIdMap.get(edge.source)
      const target = nodeIdMap.get(edge.target)
      return source && target
        ? [{ ...structuredClone(edge), id: crypto.randomUUID(), source, target }]
        : []
    }),
    nodes: sourceCanvas.nodes.map((node) => ({
      ...structuredClone(node),
      id: nodeIdMap.get(node.id)!,
    })),
  }
}

function copyLocalMap(
  state: LocalWorkspaceState,
  sourceMapId: ResourceId,
  copiedMapId: ResourceId,
): LocalMap {
  const sourceMap = requireLocalMap(state, sourceMapId)
  const layerIdMap = new Map(
    (sourceMap.layers ?? []).map((layer) => [layer.id, `${copiedMapId}-${layer.id}`] as const),
  )
  return {
    id: copiedMapId,
    imageUrl: sourceMap.imageUrl,
    ...(sourceMap.layers
      ? {
          layers: sourceMap.layers.map((layer) => ({
            ...layer,
            id: layerIdMap.get(layer.id) ?? layer.id,
          })),
        }
      : {}),
    pins: sourceMap.pins.map((pin) => ({
      ...pin,
      id: generateDomainId(DOMAIN_ID_KIND.mapPin),
      layerId: pin.layerId ? (layerIdMap.get(pin.layerId) ?? pin.layerId) : pin.layerId,
    })),
  }
}

function remapLocalMapPins(map: LocalMap, idMap: ReadonlyMap<ResourceId, ResourceId>): LocalMap {
  return {
    ...map,
    pins: map.pins.map((pin) => ({
      ...pin,
      itemId: idMap.get(pin.itemId) ?? pin.itemId,
    })),
  }
}

function copyMemberItemPermissions(
  memberItemPermissionsById: LocalWorkspaceState['memberItemPermissionsById'],
  idMap: ReadonlyMap<ResourceId, ResourceId>,
): LocalWorkspaceState['memberItemPermissionsById'] {
  if (!memberItemPermissionsById) return undefined

  let nextMemberItemPermissionsById: LocalWorkspaceState['memberItemPermissionsById'] =
    memberItemPermissionsById
  for (const [sourceItemId, copiedItemId] of idMap) {
    const sourcePermissions = memberItemPermissionsById[sourceItemId]
    if (!sourcePermissions) continue
    nextMemberItemPermissionsById = {
      ...nextMemberItemPermissionsById,
      [copiedItemId]: { ...sourcePermissions },
    }
  }
  return nextMemberItemPermissionsById
}

function removeMemberItemPermissionsForItems(
  memberItemPermissionsById: LocalWorkspaceState['memberItemPermissionsById'],
  removedItemIds: ReadonlySet<ResourceId>,
): LocalWorkspaceState['memberItemPermissionsById'] {
  if (!memberItemPermissionsById) return undefined

  const nextMemberItemPermissionsById = { ...memberItemPermissionsById }
  for (const itemId of removedItemIds) {
    delete nextMemberItemPermissionsById[itemId]
  }
  return Object.keys(nextMemberItemPermissionsById).length > 0
    ? nextMemberItemPermissionsById
    : undefined
}

function removeMapContentForItems(
  mapsById: Record<string, LocalMap>,
  removedItemIds: ReadonlySet<ResourceId>,
) {
  const nextMaps = { ...mapsById }
  for (const itemId of removedItemIds) {
    delete nextMaps[itemId]
  }
  for (const [mapId, map] of Object.entries(nextMaps)) {
    nextMaps[mapId] = {
      ...map,
      pins: map.pins.filter((pin) => !removedItemIds.has(pin.itemId)),
    }
  }
  return nextMaps
}

function normalizedRootIds(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  options: { status?: LocalWorkspaceItem['status'] } = {},
) {
  const itemsById = new Map(state.items.map((item) => [item.id, item] as const))
  const selectedIds = new Set(
    itemIds.filter((itemId) => {
      const item = itemsById.get(itemId)
      return item && (!options.status || item.status === options.status)
    }),
  )
  const roots: Array<ResourceId> = []
  const rootIds = new Set<ResourceId>()

  for (const itemId of itemIds) {
    const item = itemsById.get(itemId)
    if (item && options.status && item.status !== options.status) continue
    if (!item) continue
    let parentId = item.parentId
    let isChildOfSelection = false
    while (parentId) {
      if (selectedIds.has(parentId)) {
        isChildOfSelection = true
        break
      }
      parentId = itemsById.get(parentId)?.parentId ?? null
    }
    if (!isChildOfSelection && !rootIds.has(itemId)) {
      rootIds.add(itemId)
      roots.push(itemId)
    }
  }

  return roots
}

function childrenOf(
  state: LocalWorkspaceState,
  parentId: ResourceId,
  status?: LocalWorkspaceItem['status'],
) {
  return state.items.filter(
    (item) => item.parentId === parentId && (!status || item.status === status),
  )
}

function descendantItemIds(
  state: LocalWorkspaceState,
  itemId: ResourceId,
  status?: LocalWorkspaceItem['status'],
): Array<ResourceId> {
  return childrenOf(state, itemId, status).flatMap((child) => [
    child.id,
    ...descendantItemIds(state, child.id, status),
  ])
}

function itemIdsWithDescendants(
  state: LocalWorkspaceState,
  itemIds: Array<ResourceId>,
  options: {
    descendantStatus?: LocalWorkspaceItem['status']
    rootStatus?: LocalWorkspaceItem['status']
  } = {},
) {
  return new Set(
    normalizedRootIds(state, itemIds, { status: options.rootStatus }).flatMap((id) => [
      id,
      ...descendantItemIds(state, id, options.descendantStatus),
    ]),
  )
}

function isValidLocalParentTarget(state: LocalWorkspaceState, targetParentId: ResourceId | null) {
  if (targetParentId === null) return true
  const target = state.items.find((item) => item.id === targetParentId)
  return target?.type === 'folder' && target.status === 'active'
}

function applyLocalItemCreation(
  state: LocalWorkspaceState,
  creation: LocalItemCreation,
): LocalWorkspaceState {
  if (creation.id !== creation.item.id) return state
  if (state.items.some((item) => item.id === creation.item.id)) return state
  if (!isValidLocalParentTarget(state, creation.item.parentId)) return state

  const canvasPayloadsById =
    creation.item.type === 'canvas'
      ? { ...state.canvasPayloadsById, [creation.id]: emptyLocalCanvasPayload() }
      : state.canvasPayloadsById
  const filePayloadsById =
    creation.item.type === 'file'
      ? { ...state.filePayloadsById, [creation.id]: emptyLocalFilePayload(creation.item) }
      : state.filePayloadsById
  const mapsById =
    creation.item.type === 'map'
      ? {
          ...state.mapsById,
          [creation.id]: { id: creation.id, imageUrl: null, pins: [] },
        }
      : state.mapsById

  return {
    ...state,
    canvasPayloadsById,
    filePayloadsById,
    items: [...state.items, creation.item],
    mapsById,
    nextLocalItemIndex: creation.nextLocalItemIndex,
    noteBodiesById:
      creation.item.type === 'note'
        ? { ...state.noteBodiesById, [creation.id]: '' }
        : state.noteBodiesById,
    noteAdditionalBlocksById:
      creation.item.type === 'note'
        ? { ...state.noteAdditionalBlocksById, [creation.id]: [] }
        : state.noteAdditionalBlocksById,
  }
}

export function createLocalItemCreationSession(initialIndex: number) {
  let nextIndex = initialIndex
  const claimNextIndex = () => {
    const index = nextIndex
    nextIndex += 1
    return index
  }

  return {
    claimNextIndex,
    create({
      color,
      iconName,
      parentId,
      type,
    }: {
      color?: LocalResourceColor
      iconName?: LocalResourceIconName
      parentId: ResourceId | null
      type: LocalWorkspaceItemType
    }): LocalItemCreation {
      const index = claimNextIndex()
      const creation = createLocalItemCreation({
        color,
        iconName,
        index,
        parentId,
        type,
      })
      return creation
    },
  }
}

function createLocalItemCreation({
  color,
  iconName,
  index,
  parentId,
  type,
}: {
  color?: LocalResourceColor
  iconName?: LocalResourceIconName
  index: number
  parentId: ResourceId | null
  type: LocalWorkspaceItemType
}): LocalItemCreation {
  const id = generateDomainId(DOMAIN_ID_KIND.resource)
  const createdAt = createLocalWorkspaceMutationTimestamp()
  const slug = requireLocalResourceSlug(`local-${type}-${index}`)
  const item: LocalWorkspaceItem = {
    color,
    createdAt,
    id,
    iconName,
    parentId,
    slug,
    status: 'active',
    trashedAt: null,
    type,
    updatedAt: createdAt,
    title: localItemTitle(type),
    description: localItemDescription(type),
  }

  return {
    id,
    item,
    nextLocalItemIndex: index + 1,
    slug,
  }
}

export function localItemTypeForSidebarItemType(
  sidebarItemType: LocalSidebarItemType,
): LocalWorkspaceItemType {
  return LOCAL_ITEM_TYPES_BY_SIDEBAR_TYPE[sidebarItemType]
}

function requireLocalResourceSlug(value: string): WizardEditorResourceSlug {
  const slug = parseWizardEditorResourceSlug(value)
  if (!slug) throw new Error(`Invalid local resource slug: ${value}`)
  return slug
}

function localItemTitle(type: LocalWorkspaceItemType) {
  if (type === 'folder') return 'New Folder'
  if (type === 'canvas') return 'New Canvas'
  if (type === 'map') return 'New Map'
  if (type === 'file') return 'New File'
  return 'Untitled Note'
}

function localItemDescription(type: LocalWorkspaceItemType) {
  if (type === 'folder') return 'Folder'
  if (type === 'canvas') return 'Canvas'
  if (type === 'map') return 'Map pins'
  if (type === 'file') return 'Handout'
  return 'Session note'
}

function emptyLocalCanvasPayload(): LocalCanvasPayload {
  return { edges: [], nodes: [] }
}

function emptyLocalFilePayload(item: Pick<LocalWorkspaceItem, 'title'>): LocalFilePayload {
  return createLocalTextFilePayload({
    body: '',
    contentType: 'text/plain',
    name: `${item.title || 'Untitled File'}.txt`,
  })
}

export function createLocalTextFilePayload({
  body,
  contentType,
  name,
}: {
  body: string
  contentType: string
  name: string
}): LocalFilePayload {
  return {
    allowDataUrl: true,
    allowObjectUrl: false,
    contentType,
    downloadUrl: `data:${contentType};charset=utf-8,${encodeURIComponent(body)}`,
    name,
    size: localFileBodySize({ body, contentType }),
    status: 'available',
  }
}

function localFileBodySize(file: { body: string; contentType: string }) {
  if (isTextContentType(file.contentType)) {
    return new TextEncoder().encode(file.body).length
  }

  return new Blob([file.body], { type: file.contentType }).size
}

function isTextContentType(contentType: string) {
  return contentType.startsWith('text/') || contentType === 'application/json'
}
