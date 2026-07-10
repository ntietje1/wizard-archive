import { assertResourceItemName, assertResourceItemSlug } from '../workspace/items'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../workspace/items-persistence-contract'
import type { AnyItem, FolderItem } from '../workspace/items'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import type { FileItem } from '../files/item-contract'
import type { MapItem } from '../game-maps/item-contract'
import type { CanvasItem } from '../canvas/item-contract'
import type { NoteItem } from '../notes/item-contract'
import type { ResourceWorkspaceId } from '../workspace/resource-contract'
import type { UserProfileId } from '../../../../shared/common/ids'

let itemCounter = 0

type SidebarItemOverrides<T extends { slug: unknown; name: unknown }> = Omit<
  Partial<T>,
  'slug' | 'name'
> & {
  name?: string
  slug?: string
}

function baseFields() {
  itemCounter++
  return {
    createdAt: itemCounter,
    name: assertResourceItemName(`Test Item ${itemCounter}`),
    iconName: null,
    color: null,
    slug: assertResourceItemSlug(`test-item-${itemCounter}`),
    campaignId: `campaign_${itemCounter}` as ResourceWorkspaceId,
    parentId: null,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewUrl: null,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: `user_${itemCounter}` as UserProfileId,
    deletionTime: null,
    deletedBy: null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    isActive: true,
    isTrashed: false,
  }
}

function withLifecycleFacts<T extends AnyItem>(item: T): T {
  const isTrashed = item.status === RESOURCE_STATUS.trashed
  return {
    ...item,
    isActive: item.status === RESOURCE_STATUS.active,
    isTrashed,
  }
}

export function resetSidebarItemFactoryCounter() {
  itemCounter = 0
}

function createSidebarItem<T extends AnyItem>(
  idPrefix: string,
  type: T['type'],
  staticFields: Partial<T>,
  overrides?: SidebarItemOverrides<T>,
): T {
  const base = baseFields()
  const { slug, name, ...rest } = overrides ?? {}
  return withLifecycleFacts({
    ...base,
    id: `${idPrefix}_${itemCounter}` as T['id'],
    type,
    ...staticFields,
    ...(name !== undefined ? { name: assertResourceItemName(name) } : {}),
    ...(slug !== undefined ? { slug: assertResourceItemSlug(slug) } : {}),
    ...rest,
  } as unknown as T)
}

export function createNote(overrides?: SidebarItemOverrides<NoteItem>): NoteItem {
  return createSidebarItem('note', RESOURCE_TYPES.notes, {}, overrides)
}

export function createFolder(overrides?: SidebarItemOverrides<FolderItem>): FolderItem {
  return createSidebarItem(
    'folder',
    RESOURCE_TYPES.folders,
    {
      inheritShares: true,
    },
    overrides,
  )
}

export function createGameMap(overrides?: SidebarItemOverrides<MapItem>): MapItem {
  return createSidebarItem(
    'map',
    RESOURCE_TYPES.gameMaps,
    {
      imageAssetId: null,
      imageUrl: null,
    },
    overrides,
  )
}

export function createCanvas(overrides?: SidebarItemOverrides<CanvasItem>): CanvasItem {
  return createSidebarItem('canvas', RESOURCE_TYPES.canvases, {}, overrides)
}

export function createFile(overrides?: SidebarItemOverrides<FileItem>): FileItem {
  return createSidebarItem(
    'file',
    RESOURCE_TYPES.files,
    {
      assetId: null,
      downloadUrl: null,
      contentType: null,
    },
    overrides,
  )
}
