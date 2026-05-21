import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'shared/sidebar-items/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { SidebarItemColor } from 'shared/sidebar-items/color'
import type { SidebarItemIconName } from 'shared/sidebar-items/icon'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { SidebarItemName } from 'shared/sidebar-items/name'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { Id } from 'convex/_generated/dataModel'
import type { PermissionLevel } from 'convex/permissions/types'
import type { SidebarItemShare } from 'convex/sidebarShares/types'
import type { SidebarItemLocation, SidebarItemStatus } from 'shared/sidebar-items/types'
import { testId } from '~/test/helpers/test-id'

let itemCounter = 0

interface BaseFields {
  _creationTime: number
  name: SidebarItemName
  iconName: SidebarItemIconName | null
  color: SidebarItemColor | null
  slug: Note['slug']
  campaignId: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  previewUrl: string | null
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
  isActive: boolean
  isTrashed: boolean
}

function baseFields(): BaseFields {
  itemCounter++
  return {
    _creationTime: Date.now(),
    name: assertSidebarItemName(`Test Item ${itemCounter}`),
    iconName: null,
    color: null,
    slug: assertSidebarItemSlug(`test-item-${itemCounter}`),
    campaignId: testId('campaign_1'),
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewUrl: null,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: testId('user_1'),
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    isActive: true,
    isTrashed: false,
  }
}

type SidebarItemOverrides<T extends { slug: unknown; name: unknown }> = Omit<
  Partial<T>,
  'slug' | 'name'
> & {
  name?: string
  slug?: string
}

function withLifecycleFacts<T extends BaseFields>(item: T): T {
  const isTrashed = item.status === SIDEBAR_ITEM_STATUS.trashed
  return {
    ...item,
    isActive: item.status === SIDEBAR_ITEM_STATUS.active,
    isTrashed,
  }
}

export function createNote(overrides?: SidebarItemOverrides<Note>): Note {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    _id: testId<'sidebarItems'>(`note_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.notes,
    ...(name !== undefined ? { name: assertSidebarItemName(name) } : {}),
    ...(slug !== undefined ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  })
}

export function createFolder(overrides?: SidebarItemOverrides<Folder>): Folder {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    _id: testId<'sidebarItems'>(`folder_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.folders,
    inheritShares: true,
    ...(name !== undefined ? { name: assertSidebarItemName(name) } : {}),
    ...(slug !== undefined ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  })
}

export function createGameMap(overrides?: SidebarItemOverrides<GameMap>): GameMap {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    _id: testId<'sidebarItems'>(`map_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    imageStorageId: null,
    imageUrl: null,
    ...(name !== undefined ? { name: assertSidebarItemName(name) } : {}),
    ...(slug !== undefined ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  })
}

export function createFile(overrides?: SidebarItemOverrides<SidebarFile>): SidebarFile {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    _id: testId<'sidebarItems'>(`file_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.files,
    storageId: null,
    downloadUrl: null,
    contentType: null,
    ...(name !== undefined ? { name: assertSidebarItemName(name) } : {}),
    ...(slug !== undefined ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  })
}
