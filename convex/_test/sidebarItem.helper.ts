import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type { CanvasItem } from '@wizard-archive/editor/canvas/item-contract'
import type { FileItem } from '@wizard-archive/editor/files/item-contract'
import type { MapItem } from '@wizard-archive/editor/game-maps/item-contract'
import type { NoteItem } from '@wizard-archive/editor/notes/item-contract'
import type { AnyItem, FolderItem } from '@wizard-archive/editor/resources/items'
import { testCampaignId } from '../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../shared/test/campaign-member-id'
import { testResourceId } from '../../shared/test/resource-id'

function assertNeverSidebarItemType(type: never): never {
  throw new Error(`Unhandled sidebar item type: ${String(type)}`)
}

export function createSidebarItem(
  id: string,
  name: string,
  type: AnyItem['type'] = RESOURCE_TYPES.notes,
  overrides: Partial<Omit<AnyItem, 'type' | 'location'>> = {},
): AnyItem {
  const common = {
    id: testResourceId(id),
    createdAt: 1,
    name: name as AnyItem['name'],
    campaignId: testCampaignId('campaign'),
    iconName: null,
    color: null,
    parentId: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: testCampaignMemberId('user'),
    deletionTime: null,
    deletedBy: null,
    isActive: true,
    isTrashed: false,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
  }

  switch (type) {
    case RESOURCE_TYPES.notes: {
      const item = { ...common, type } satisfies NoteItem
      return Object.assign(item, overrides)
    }
    case RESOURCE_TYPES.folders: {
      const item = { ...common, inheritShares: false, type } satisfies FolderItem
      return Object.assign(item, overrides)
    }
    case RESOURCE_TYPES.gameMaps: {
      const item = {
        ...common,
        imageAssetId: null,
        imageUrl: null,
        type,
      } satisfies MapItem
      return Object.assign(item, overrides)
    }
    case RESOURCE_TYPES.files: {
      const item = {
        ...common,
        assetId: null,
        downloadUrl: null,
        contentType: null,
        type,
      } satisfies FileItem
      return Object.assign(item, overrides)
    }
    case RESOURCE_TYPES.canvases: {
      const item = { ...common, type } satisfies CanvasItem
      return Object.assign(item, overrides)
    }
    default:
      return assertNeverSidebarItemType(type)
  }
}
