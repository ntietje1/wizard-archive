import { DOMAIN_ID_KIND, isUuidV7, parseDomainId } from '../resources/domain-id'
import type { AssetId, MapPinId, ResourceId } from '../resources/domain-id'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../resources/items-persistence-contract'
import type { ResourceStatus, ResourceKind } from '../resources/resource-contract'

export type PinDropValidationCode =
  | 'self_pin'
  | 'already_pinned'
  | 'trashed_item'
  | 'wrong_workspace'

export type PinDropValidationItem<TItemId extends string, TWorkspaceId extends string> = {
  id: TItemId
  workspaceId: TWorkspaceId
  status: ResourceStatus
}

export interface MapPinCreationInput<TItemId extends string = ResourceId> {
  itemId: TItemId
  x: number
  y: number
}

export interface PlanMapPinCreationsInput<
  TPin,
  TPinInput extends MapPinCreationInput<TItemId>,
  TItemId extends string = ResourceId,
> {
  mapId: TItemId
  existingPinnedItemIds: Iterable<TItemId>
  pins: ReadonlyArray<TPinInput>
  canPinItem: (itemId: TItemId) => boolean
  createPin: (pin: TPinInput) => TPin
}

export type MapLayer = {
  id: string
  imageAssetId: AssetId | null
  imageUrl: string | null
  name: string
}

export type MapPin = {
  id: MapPinId
  createdAt: number
  layerId?: string | null
  mapId: ResourceId
  itemId: ResourceId
  x: number
  y: number
  visible: boolean
}

type GameMapSnapshotPinData = {
  id: MapPinId
  itemId: ResourceId
  layerId?: string | null
  x: number
  y: number
  visible: boolean
  name: string | null
  color: string | null
  iconName: string | null
  itemType: ResourceKind | null
}

export type GameMapSnapshotData = {
  imageAssetId: AssetId | null
  layers?: Array<{ id: string; imageAssetId: AssetId | null; name: string }>
  pins: Array<GameMapSnapshotPinData>
}

export function readGameMapSnapshot(data: ArrayBuffer): GameMapSnapshotData | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(data))
    if (isGameMapSnapshotData(parsed)) return parsed

    console.error('Invalid game map snapshot data shape')
    return null
  } catch (error) {
    console.error('Failed to parse game map snapshot data:', error)
    return null
  }
}

function isGameMapSnapshotData(value: unknown): value is GameMapSnapshotData {
  if (!isRecord(value)) return false
  if (!(value.imageAssetId === null || isAssetId(value.imageAssetId))) return false
  if (
    value.layers !== undefined &&
    (!Array.isArray(value.layers) ||
      !value.layers.every(
        (layer) =>
          isRecord(layer) &&
          typeof layer.id === 'string' &&
          typeof layer.name === 'string' &&
          (layer.imageAssetId === null || isAssetId(layer.imageAssetId)),
      ))
  ) {
    return false
  }
  if (!Array.isArray(value.pins)) return false

  return value.pins.every(isGameMapSnapshotPinData)
}

function isAssetId(value: unknown): value is AssetId {
  return typeof value === 'string' && parseDomainId(DOMAIN_ID_KIND.asset, value) !== null
}

function isGameMapSnapshotPinData(value: unknown) {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    isUuidV7(value.id) &&
    typeof value.itemId === 'string' &&
    (value.layerId === undefined || value.layerId === null || typeof value.layerId === 'string') &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.visible === 'boolean' &&
    (typeof value.name === 'string' || value.name === null) &&
    (typeof value.color === 'string' || value.color === null) &&
    (typeof value.iconName === 'string' || value.iconName === null) &&
    (value.itemType === null ||
      (typeof value.itemType === 'string' &&
        Object.values(RESOURCE_TYPES).includes(value.itemType as ResourceKind)))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validatePinTarget<TItemId extends string>(
  mapId: TItemId,
  itemId: TItemId,
  existingPinItemIds: ReadonlyArray<TItemId>,
): string | null {
  const code = validateUniquePinTarget(mapId, itemId, existingPinItemIds)
  switch (code) {
    case 'self_pin':
      return 'Cannot pin a map to itself'
    case 'already_pinned':
      return 'Item is already pinned on this map'
    case null:
      return null
  }
}

export function validatePinDropTarget<TItemId extends string, TWorkspaceId extends string>({
  mapId,
  item,
  existingPinItemIds,
  workspaceId,
}: {
  mapId: TItemId
  item: PinDropValidationItem<TItemId, TWorkspaceId>
  existingPinItemIds: ReadonlyArray<TItemId>
  workspaceId: TWorkspaceId | null
}): PinDropValidationCode | null {
  const pinTargetError = validateUniquePinTarget(mapId, item.id, existingPinItemIds)
  if (pinTargetError) return pinTargetError
  if (item.status === RESOURCE_STATUS.trashed) return 'trashed_item'
  if (workspaceId !== null && item.workspaceId !== workspaceId) return 'wrong_workspace'
  return null
}

function validateUniquePinTarget<TItemId extends string>(
  mapId: TItemId,
  itemId: TItemId,
  existingPinItemIds: ReadonlyArray<TItemId>,
): Extract<PinDropValidationCode, 'self_pin' | 'already_pinned'> | null {
  if (itemId === mapId) return 'self_pin'
  if (existingPinItemIds.includes(itemId)) return 'already_pinned'
  return null
}

export function planMapPinCreations<
  TPin,
  TPinInput extends MapPinCreationInput<TItemId>,
  TItemId extends string = ResourceId,
>({
  mapId,
  existingPinnedItemIds,
  pins,
  canPinItem,
  createPin,
}: PlanMapPinCreationsInput<TPin, TPinInput, TItemId>): Array<TPin> {
  const pinnedItemIds = new Set(existingPinnedItemIds)
  const createdPins: Array<TPin> = []

  for (const pin of pins) {
    if (pin.itemId === mapId) continue
    if (pinnedItemIds.has(pin.itemId)) continue
    if (!canPinItem(pin.itemId)) continue
    pinnedItemIds.add(pin.itemId)
    createdPins.push(createPin(pin))
  }

  return createdPins
}
