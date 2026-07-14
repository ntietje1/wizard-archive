import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../../../workspace/items-persistence-contract'
import type { CanvasItem } from '../../../canvas/item-contract'
import type { FileItem } from '../../../files/item-contract'
import type { MapItem } from '../../../game-maps/item-contract'
import type { NoteItem } from '../../../notes/item-contract'
import type { AnyItem, FolderItem } from '../../../workspace/items'
import { slugify } from '../../../../../../shared/slugs'
import type { SidebarItemId, UserProfileId } from '../../../../../../shared/common/ids'
import { testCampaignId } from '../../../../../../shared/test/campaign-id'

function assertNeverSidebarItemType(type: never): never {
  throw new Error(`Unhandled sidebar item type: ${String(type)}`)
}

function testSidebarSlug(name: string): AnyItem['slug'] {
  const slug = slugify(name)
  return (slug.length >= 3 ? slug : `${slug || 'item'}-item`) as AnyItem['slug']
}

export function createSidebarItem(
  id: string,
  name: string,
  type: AnyItem['type'] = RESOURCE_TYPES.notes,
  overrides: Partial<Omit<AnyItem, 'type' | 'location'>> = {},
): AnyItem {
  const common = {
    id: id as SidebarItemId,
    createdAt: 1,
    name: name as AnyItem['name'],
    slug: testSidebarSlug(name),
    campaignId: testCampaignId('campaign'),
    iconName: null,
    color: null,
    parentId: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user' as UserProfileId,
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

export function createTrashedSidebarItem(
  id: string,
  name: string,
  type: AnyItem['type'] = RESOURCE_TYPES.notes,
  overrides: Partial<Omit<AnyItem, 'type' | 'location'>> = {},
): AnyItem {
  return createSidebarItem(id, name, type, {
    ...overrides,
    status: RESOURCE_STATUS.trashed,
    isActive: false,
    isTrashed: true,
  })
}
