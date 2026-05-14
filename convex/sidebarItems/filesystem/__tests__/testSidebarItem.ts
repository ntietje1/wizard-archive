import { PERMISSION_LEVEL } from '../../../permissions/types'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from '../../types/baseTypes'
import { slugify } from '../../../common/slug'
import type { Id } from '../../../_generated/dataModel'
import type { AnySidebarItem } from '../../types/types'

function assertNeverSidebarItemType(type: never): never {
  throw new Error(`Unhandled sidebar item type: ${String(type)}`)
}

function testSidebarSlug(name: string): AnySidebarItem['slug'] {
  const slug = slugify(name)
  return (slug.length >= 3 ? slug : `${slug || 'item'}-item`) as AnySidebarItem['slug']
}

export function createSidebarItem(
  id: string,
  name: string,
  type: AnySidebarItem['type'] = SIDEBAR_ITEM_TYPES.notes,
  overrides: Partial<Omit<AnySidebarItem, 'type' | 'location'>> = {},
): AnySidebarItem {
  const common = {
    _id: id as Id<'sidebarItems'>,
    _creationTime: 1,
    name: name as AnySidebarItem['name'],
    slug: testSidebarSlug(name),
    campaignId: 'campaign' as Id<'campaigns'>,
    iconName: null,
    color: null,
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'user' as Id<'userProfiles'>,
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
    case SIDEBAR_ITEM_TYPES.notes: {
      const item = { ...common, type } satisfies Extract<
        AnySidebarItem,
        { type: typeof SIDEBAR_ITEM_TYPES.notes }
      >
      return Object.assign(item, overrides)
    }
    case SIDEBAR_ITEM_TYPES.folders: {
      const item = { ...common, inheritShares: false, type } satisfies Extract<
        AnySidebarItem,
        { type: typeof SIDEBAR_ITEM_TYPES.folders }
      >
      return Object.assign(item, overrides)
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const item = {
        ...common,
        imageStorageId: null,
        imageUrl: null,
        type,
      } satisfies Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.gameMaps }>
      return Object.assign(item, overrides)
    }
    case SIDEBAR_ITEM_TYPES.files: {
      const item = {
        ...common,
        storageId: null,
        downloadUrl: null,
        contentType: null,
        type,
      } satisfies Extract<AnySidebarItem, { type: typeof SIDEBAR_ITEM_TYPES.files }>
      return Object.assign(item, overrides)
    }
    case SIDEBAR_ITEM_TYPES.canvases: {
      const item = { ...common, type } satisfies Extract<
        AnySidebarItem,
        { type: typeof SIDEBAR_ITEM_TYPES.canvases }
      >
      return Object.assign(item, overrides)
    }
    default:
      return assertNeverSidebarItemType(type)
  }
}
