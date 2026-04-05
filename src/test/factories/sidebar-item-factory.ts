import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
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
  slug: string
  campaignId: Id<'campaigns'>
  parentId: Id<'folders'> | null
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewUpdatedAt: number | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
  previewUrl: string | null
}

function baseFields(): BaseFields {
  itemCounter++
  return {
    _creationTime: Date.now(),
    name: `Test Item ${itemCounter}`,
    iconName: null,
    color: null,
    slug: `test-item-${itemCounter}`,
    campaignId: testId('campaign_1'),
    parentId: null,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: testId('user_1'),
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
  }
}

export function createNote(overrides?: Partial<Note>): Note {
  const base = baseFields()
  return {
    ...base,
    _id: testId<'notes'>(`note_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.notes,
    ...overrides,
  }
}

export function createFolder(overrides?: Partial<Folder>): Folder {
  const base = baseFields()
  return {
    ...base,
    _id: testId<'folders'>(`folder_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.folders,
    inheritShares: true,
    ...overrides,
  }
}

export function createGameMap(overrides?: Partial<GameMap>): GameMap {
  const base = baseFields()
  return {
    ...base,
    _id: testId<'gameMaps'>(`map_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    imageStorageId: null,
    imageUrl: null,
    ...overrides,
  }
}

export function createFile(overrides?: Partial<SidebarFile>): SidebarFile {
  const base = baseFields()
  return {
    ...base,
    _id: testId<'files'>(`file_${itemCounter}`),
    type: SIDEBAR_ITEM_TYPES.files,
    storageId: null,
    downloadUrl: null,
    contentType: null,
    ...overrides,
  }
}
