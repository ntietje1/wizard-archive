import type {
  CampaignId,
  MapPinId,
  SidebarItemId,
  UserProfileId,
} from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { completedResourceOperation } from '../../../filesystem/transaction-contract'
import type { ResourceOperationResult } from '../../../filesystem/transaction-contract'
import type { MapItem, MapItemWithContent, MapPinWithItem } from '../../../game-maps/item-contract'
import type { MapPinsCreateResult } from '../../../game-maps/session-contract'
import type { NoteItem } from '../../../notes/item-contract'
import type { AnyItem } from '../../../workspace/items'
import {
  assertResourceItemColor,
  assertResourceItemName,
  assertResourceItemSlug,
} from '../../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'

export function testId(id: string): SidebarItemId
export function testId<Id extends string>(id: string): Id
export function testId<Id extends string>(id: string): Id {
  return id as Id
}

export function createGameMapFixture({
  id = testId('map-1'),
  imageUrl = null,
  name = 'Map',
  pins = [],
}: {
  id?: SidebarItemId
  imageUrl?: string | null
  name?: string
  pins?: Array<MapPinWithItem<AnyItem>>
} = {}): MapItemWithContent<AnyItem> {
  return {
    ...createMapItemFixture({ id, imageUrl, name }),
    ancestors: [],
    pins,
  }
}

function createMapItemFixture({
  id = testId('map-1'),
  imageUrl = null,
  name = 'Map',
}: {
  id?: SidebarItemId
  imageUrl?: string | null
  name?: string
} = {}): MapItem {
  return {
    ...createBaseResourceItem({ id, name }),
    imageAssetId: null,
    imageUrl,
    type: RESOURCE_TYPES.gameMaps,
  }
}

export function createNoteFixture({
  color = null,
  id = testId('note-1'),
  name = 'Note',
}: {
  color?: string | null
  id?: SidebarItemId
  name?: string
} = {}): NoteItem {
  return {
    ...createBaseResourceItem({ color, id, name }),
    type: RESOURCE_TYPES.notes,
  }
}

export function createMapPinFixture({
  id = testId<MapPinId>('map-pin-1'),
  item = createNoteFixture(),
  map = createGameMapFixture(),
  visible = true,
  x = 25,
  y = 50,
}: {
  id?: MapPinId
  item?: AnyItem
  map?: MapItemWithContent
  visible?: boolean
  x?: number
  y?: number
} = {}): MapPinWithItem<AnyItem> {
  return {
    id,
    createdAt: 0,
    mapId: map.id,
    itemId: item.id,
    item,
    visible,
    x,
    y,
  }
}

export function completedMapImageUpdate(): ResourceOperationResult {
  return completedResourceOperation({
    kind: 'mapImageUpdated',
    affectedCount: 1,
  })
}

export function completedMapPinUpdate(): ResourceOperationResult {
  return completedResourceOperation({
    kind: 'mapPinUpdated',
    affectedCount: 1,
  })
}

export function completedMapPinsCreate(
  mapId: SidebarItemId,
  pinIds: Array<MapPinWithItem['id']>,
): MapPinsCreateResult {
  return {
    status: 'completed',
    receipt: {
      kind: 'mapPinsCreated',
      itemId: mapId,
      affectedCount: pinIds.length,
      pinIds,
    },
  }
}

function createBaseResourceItem({
  color = null,
  id,
  name,
}: {
  color?: string | null
  id: SidebarItemId
  name: string
}) {
  return {
    createdAt: 0,
    id,
    allPermissionLevel: null,
    campaignId: testId<CampaignId>('campaign-1'),
    color: color ? assertResourceItemColor(color) : null,
    createdBy: testId<UserProfileId>('user-1'),
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name: assertResourceItemName(name),
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    slug: assertResourceItemSlug(name.toLowerCase().replace(/\s+/gu, '-')),
    status: RESOURCE_STATUS.active,
    updatedBy: null,
    updatedTime: null,
  }
}
