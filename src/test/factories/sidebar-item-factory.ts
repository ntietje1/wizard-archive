import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { assertSidebarItemSlug } from 'convex/sidebarItems/slug'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { Id } from 'convex/_generated/dataModel'
import type { PermissionLevel } from 'convex/permissions/types'
import type { SidebarItemShare } from 'convex/sidebarShares/types'
import type { SidebarItemLocation } from 'convex/sidebarItems/types/baseTypes'
import { testId } from '~/test/helpers/test-id'

let itemCounter = 0

interface BaseFields {
  _creationTime: number
  name: string
  iconName: string | null
  color: string | null
  slug: Note['slug']
  campaignId: Id<'campaigns'>
  parentId: Id<'sidebarItems'> | null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
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
}

function baseFields(): BaseFields {
  itemCounter++
  return {
    _creationTime: Date.now(),
    name: `Test Item ${itemCounter}`,
    iconName: null,
    color: null,
    slug: assertSidebarItemSlug(`test-item-${itemCounter}`),
    campaignId: testId('campaign_1'),
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
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
  }
}

type SidebarItemOverrides<T extends { slug: unknown }> = Omit<Partial<T>, 'slug'> & {
  slug?: string
}

export function createNote(overrides?: SidebarItemOverrides<Note>): Note {
  const base = baseFields()
  const { slug, ...rest } = overrides ?? {}
  return {
    ...base,
    _id: testId<'sidebarItems'>(`note_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.notes,
    ...(slug ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  }
}

export function createFolder(overrides?: SidebarItemOverrides<Folder>): Folder {
  const base = baseFields()
  const { slug, ...rest } = overrides ?? {}
  return {
    ...base,
    _id: testId<'sidebarItems'>(`folder_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.folders,
    inheritShares: true,
    ...(slug ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  }
}

export function createGameMap(overrides?: SidebarItemOverrides<GameMap>): GameMap {
  const base = baseFields()
  const { slug, ...rest } = overrides ?? {}
  return {
    ...base,
    _id: testId<'sidebarItems'>(`map_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    imageStorageId: null,
    imageUrl: null,
    ...(slug ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  }
}

export function createFile(overrides?: SidebarItemOverrides<SidebarFile>): SidebarFile {
  const base = baseFields()
  const { slug, ...rest } = overrides ?? {}
  return {
    ...base,
    _id: testId<'sidebarItems'>(`file_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.files,
    storageId: null,
    downloadUrl: null,
    contentType: null,
    ...(slug ? { slug: assertSidebarItemSlug(slug) } : {}),
    ...rest,
  }
}
