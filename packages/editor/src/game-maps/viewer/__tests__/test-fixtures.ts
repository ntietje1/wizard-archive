import type { ResourceId, MapPinId } from '../../../resources/domain-id'
import { testCampaignId } from '../../../../../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../../../../../shared/test/campaign-member-id'

import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { completedResourceOperation } from '../../../filesystem/transaction-contract'
import type { ResourceOperationResult } from '../../../filesystem/transaction-contract'
import type { MapItem, MapItemWithContent, MapPinWithItem } from '../../../game-maps/item-contract'
import type { MapLayer } from '../../../game-maps/document-contract'
import type { MapPinsCreateResult } from '../../../game-maps/session-contract'
import type { NoteItem } from '../../../notes/item-contract'
import type { AnyItem } from '../../../workspace/items'
import { assertResourceItemColor, canonicalizeResourceItemTitle } from '../../../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'

export function testId(id: string): ResourceId
export function testId<Id extends string>(id: string): Id
export function testId<Id extends string>(id: string): Id {
  return id as Id
}

export function createGameMapFixture({
  id = testId('map-1'),
  imageUrl = null,
  layers,
  name = 'Map',
  pins = [],
}: {
  id?: ResourceId
  imageUrl?: string | null
  layers?: Array<MapLayer>
  name?: string
  pins?: Array<MapPinWithItem<AnyItem>>
} = {}): MapItemWithContent<AnyItem> {
  return {
    ...createMapItemFixture({ id, imageUrl, name }),
    ancestors: [],
    pins,
    ...(layers ? { layers } : {}),
  }
}

function createMapItemFixture({
  id = testId('map-1'),
  imageUrl = null,
  name = 'Map',
}: {
  id?: ResourceId
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
  id?: ResourceId
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
  mapId: ResourceId,
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
  id: ResourceId
  name: string
}) {
  return {
    createdAt: 0,
    id,
    allPermissionLevel: null,
    campaignId: testCampaignId('campaign-1'),
    color: color ? assertResourceItemColor(color) : null,
    createdBy: testCampaignMemberId('user-1'),
    deletedBy: null,
    deletionTime: null,
    iconName: null,
    isActive: true,
    isBookmarked: false,
    isTrashed: false,
    location: RESOURCE_LOCATION.sidebar,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    name: canonicalizeResourceItemTitle(name),
    parentId: null,
    previewAssetId: null,
    previewUrl: null,
    shares: [],
    status: RESOURCE_STATUS.active,
    updatedBy: null,
    updatedTime: null,
  }
}
