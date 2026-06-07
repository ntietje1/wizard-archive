import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { diffSidebarItemFields } from 'shared/sidebar-items/filesystem/patches'
import { deduplicateSlug, slugify } from '../../../shared/slugs'
import { assertSidebarItemSlug, SIDEBAR_ITEM_SLUG_MAX_LENGTH } from 'shared/sidebar-items/slug'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { FileSystemPatch } from 'shared/sidebar-items/filesystem/receipts'
import type { FileSystemOptimisticPreview } from 'shared/sidebar-items/filesystem/lifecycle'
import type {
  CreateFileSystemCommand,
  RenameFileSystemCommand,
} from 'shared/sidebar-items/filesystem/commands'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'
import { OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX } from './optimistic-sidebar-items'
import { logger } from '~/shared/utils/logger'

let optimisticIdIndex = 0

function nextOptimisticIdIndex() {
  optimisticIdIndex += 1
  return optimisticIdIndex
}

export function expectedOptimisticCreateSlug(
  name: string,
  existingSlugs: ReadonlySet<string>,
): SidebarItemSlug {
  const normalized = slugify(name, {
    fallback: 'item',
    maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
  })
  return assertSidebarItemSlug(
    deduplicateSlug(normalized, existingSlugs, {
      label: 'Slug',
      maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
    }),
  )
}

export function buildOptimisticCreatePreview({
  command,
  parentId,
  currentUserId,
  campaignId,
  name,
  slug,
  now = Date.now(),
}: {
  command: CreateFileSystemCommand
  parentId: Id<'sidebarItems'> | null
  currentUserId: Id<'userProfiles'> | null
  campaignId: Id<'campaigns'>
  name: AnySidebarItem['name']
  slug: SidebarItemSlug
  now?: number
}): FileSystemOptimisticPreview {
  if (!currentUserId) {
    logger.warn('Skipping optimistic filesystem create because current user id is unavailable')
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const index = nextOptimisticIdIndex()
  const item: AnySidebarItem = {
    _id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}create-${now}-${index}` as Id<'sidebarItems'>,
    _creationTime: now,
    name,
    slug,
    campaignId,
    parentId,
    type: command.itemType,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: currentUserId,
    deletionTime: null,
    deletedBy: null,
    isActive: true,
    isTrashed: false,
    iconName: command.iconName ?? null,
    color: command.color ?? null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
  } as AnySidebarItem

  const receiptPatches: Array<FileSystemPatch> = [{ type: 'upsertSidebarItem', item }]
  return {
    receiptPatches,
    inversePatches: [{ type: 'removeSidebarItem', itemId: item._id, snapshot: item }],
    optimisticIntents: parentId
      ? [{ type: 'openFolder' as const, campaignId, folderId: parentId }]
      : [],
    rollbackIntents: [],
  }
}

export function buildOptimisticRenamePreview(
  snapshot: SidebarCacheSnapshot,
  command: RenameFileSystemCommand,
): FileSystemOptimisticPreview {
  const item =
    snapshot.sidebar.find((candidate) => candidate._id === command.itemId) ??
    snapshot.trash.find((candidate) => candidate._id === command.itemId)
  if (!item) {
    // The item may have been removed by a concurrent update before the optimistic rename applies.
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const { changed: fields, previous } = diffSidebarItemFields(item, {
    ...item,
    ...(command.name !== undefined ? { name: command.name as AnySidebarItem['name'] } : {}),
    ...(command.iconName !== undefined ? { iconName: command.iconName } : {}),
    ...(command.color !== undefined ? { color: command.color } : {}),
  } as AnySidebarItem)

  const receiptPatches: Array<FileSystemPatch> = [
    { type: 'updateSidebarItem', itemId: item._id, before: previous, fields },
  ]
  return {
    receiptPatches,
    inversePatches: [
      { type: 'updateSidebarItem', itemId: item._id, before: fields, fields: previous },
    ],
    optimisticIntents: [],
    rollbackIntents: [],
  }
}
