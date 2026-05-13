import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/types/baseTypes'
import { collectDescendantIdsFromItems } from 'convex/sidebarItems/filesystem/tree'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { diffSidebarItemFields } from 'convex/sidebarItems/filesystem/patches'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import type { MoveOperation } from 'convex/sidebarItems/filesystem/operationTypes'
import type {
  CreateFileSystemCommand,
  RenameFileSystemCommand,
} from 'convex/sidebarItems/filesystem/commands'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'

const OPTIMISTIC_ID_PREFIX = 'optimistic-'
let optimisticIdIndex = 0

export function resetOptimisticIdIndex() {
  optimisticIdIndex = 0
}

function nextOptimisticIdIndex() {
  optimisticIdIndex += 1
  return optimisticIdIndex
}

function updatePatch(
  item: AnySidebarItem,
  after: Partial<AnySidebarItem>,
): { forward: FileSystemPatch; inverse: FileSystemPatch } {
  const { changed: fields, previous } = diffSidebarItemFields(item, {
    ...item,
    ...after,
  } as AnySidebarItem)
  return {
    forward: { type: 'updateSidebarItem', itemId: item._id, before: previous, fields },
    inverse: { type: 'updateSidebarItem', itemId: item._id, before: fields, fields: previous },
  }
}

function pushUpdate(
  patches: OptimisticPatchSet,
  item: AnySidebarItem,
  after: Partial<AnySidebarItem>,
) {
  const patch = updatePatch(item, after)
  patches.forwardPatches.push(patch.forward)
  patches.inversePatches.push(patch.inverse)
}

function pushUpsert(patches: OptimisticPatchSet, item: AnySidebarItem) {
  patches.forwardPatches.push({ type: 'upsertSidebarItem', item })
  patches.inversePatches.push({ type: 'removeSidebarItem', itemId: item._id, snapshot: item })
}

function pushRemove(patches: OptimisticPatchSet, item: AnySidebarItem) {
  patches.forwardPatches.push({ type: 'removeSidebarItem', itemId: item._id, snapshot: item })
  patches.inversePatches.push({ type: 'upsertSidebarItem', item })
}

export type OptimisticPatchSet = {
  forwardPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
}

function emptyPatchSet(): OptimisticPatchSet {
  return { forwardPatches: [], inversePatches: [] }
}

function optimisticSlug(name: string, index: number): SidebarItemSlug {
  return `${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item'
  }-optimistic-${index}` as SidebarItemSlug
}

export function buildOptimisticCreatePatches({
  command,
  parentId,
  currentUserId,
  campaignId,
  now = Date.now(),
}: {
  command: CreateFileSystemCommand
  parentId: Id<'sidebarItems'> | null
  currentUserId: Id<'userProfiles'> | null
  campaignId: Id<'campaigns'>
  now?: number
}): OptimisticPatchSet {
  const patches = emptyPatchSet()
  const index = nextOptimisticIdIndex()
  const item: AnySidebarItem = {
    _id: `${OPTIMISTIC_ID_PREFIX}create-${now}-${index}` as Id<'sidebarItems'>,
    _creationTime: now,
    name: command.name as AnySidebarItem['name'],
    slug: optimisticSlug(command.name, index),
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
    createdBy: currentUserId ?? ('optimistic-user' as Id<'userProfiles'>),
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
  pushUpsert(patches, item)
  return patches
}

export function buildOptimisticRenamePatches(
  snapshot: SidebarCacheSnapshot,
  command: RenameFileSystemCommand,
): OptimisticPatchSet {
  const patches = emptyPatchSet()
  const item =
    snapshot.sidebar.find((candidate) => candidate._id === command.itemId) ??
    snapshot.trash.find((candidate) => candidate._id === command.itemId)
  if (!item) return patches

  pushUpdate(patches, item, {
    ...(command.name !== undefined ? { name: command.name as AnySidebarItem['name'] } : {}),
    ...(command.iconName !== undefined ? { iconName: command.iconName } : {}),
    ...(command.color !== undefined ? { color: command.color } : {}),
  })
  return patches
}

function sourceTree(item: AnySidebarItem, items: Array<AnySidebarItem>) {
  if (item.type !== SIDEBAR_ITEM_TYPES.folders) return [item]
  const descendantIds = collectDescendantIdsFromItems(item._id, items)
  return items.filter((candidate) => candidate._id === item._id || descendantIds.has(candidate._id))
}

function trashTree(
  patches: OptimisticPatchSet,
  item: AnySidebarItem,
  items: Array<AnySidebarItem>,
  now: number,
  deletedBy: Id<'userProfiles'> | null = null,
) {
  for (const candidate of sourceTree(item, items)) {
    pushUpdate(patches, candidate, {
      parentId: candidate._id === item._id ? null : candidate.parentId,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      status: SIDEBAR_ITEM_STATUS.trashed,
      deletionTime: now,
      deletedBy,
    })
  }
}

function restoreTree(
  patches: OptimisticPatchSet,
  item: AnySidebarItem,
  trash: Array<AnySidebarItem>,
  targetParentId: Id<'sidebarItems'> | null,
) {
  for (const candidate of sourceTree(item, trash)) {
    pushUpdate(patches, candidate, {
      parentId: candidate._id === item._id ? targetParentId : candidate.parentId,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      status: SIDEBAR_ITEM_STATUS.active,
      deletionTime: null,
      deletedBy: null,
    })
  }
}

function trashReplacementDestination({
  patches,
  operation,
  sidebarMap,
  snapshot,
  now,
}: {
  patches: OptimisticPatchSet
  operation: MoveOperation
  sidebarMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  snapshot: SidebarCacheSnapshot
  now: number
}) {
  if (operation.action !== 'replace' || !operation.destinationItemId) return
  const destination = sidebarMap.get(operation.destinationItemId)
  if (destination) trashTree(patches, destination, snapshot.sidebar, now)
}

function applyMergeFolderOptimisticPatch({
  patches,
  operation,
  sidebarMap,
  snapshot,
  now,
}: {
  patches: OptimisticPatchSet
  operation: MoveOperation
  sidebarMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  snapshot: SidebarCacheSnapshot
  now: number
}) {
  if (operation.action !== 'mergeFolder') return false
  const source = sidebarMap.get(operation.sourceItemId)
  const hasChildren = snapshot.sidebar.some((item) => item.parentId === operation.sourceItemId)
  // The backend moves merge children individually; the folder row is trashed only once emptied.
  if (source && !hasChildren) trashTree(patches, source, snapshot.sidebar, now)
  return true
}

function applyMoveOrRestoreOptimisticPatch({
  patches,
  operation,
  sidebarMap,
  trashMap,
  snapshot,
}: {
  patches: OptimisticPatchSet
  operation: Extract<MoveOperation, { action: 'move' | 'replace' }>
  sidebarMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  snapshot: SidebarCacheSnapshot
}) {
  const source = sidebarMap.get(operation.sourceItemId) ?? trashMap.get(operation.sourceItemId)
  if (!source) return
  if (trashMap.has(source._id)) {
    restoreTree(patches, source, snapshot.trash, operation.targetParentId)
    return
  }
  pushUpdate(patches, source, {
    parentId: operation.targetParentId,
    ...(operation.name ? { name: operation.name as AnySidebarItem['name'] } : {}),
  })
}

export function buildOptimisticMovePatches(
  snapshot: SidebarCacheSnapshot,
  operations: Array<MoveOperation>,
  now = Date.now(),
): OptimisticPatchSet {
  const patches = emptyPatchSet()
  const sidebarMap = new Map(snapshot.sidebar.map((item) => [item._id, item]))
  const trashMap = new Map(snapshot.trash.map((item) => [item._id, item]))

  for (const operation of operations) {
    trashReplacementDestination({ patches, operation, sidebarMap, snapshot, now })
    if (operation.action === 'mergeFolder') {
      applyMergeFolderOptimisticPatch({ patches, operation, sidebarMap, snapshot, now })
      continue
    }
    applyMoveOrRestoreOptimisticPatch({
      patches,
      operation,
      sidebarMap,
      trashMap,
      snapshot,
    })
  }

  return patches
}

export function buildOptimisticTrashPatches(
  snapshot: SidebarCacheSnapshot,
  items: Array<AnySidebarItem>,
  now = Date.now(),
  deletedBy?: Id<'userProfiles'> | null,
): OptimisticPatchSet {
  const patches = emptyPatchSet()
  for (const item of items) {
    trashTree(patches, item, snapshot.sidebar, now, deletedBy ?? null)
  }
  return patches
}

export function buildOptimisticDeleteForeverPatches(
  snapshot: SidebarCacheSnapshot,
  items: Array<AnySidebarItem>,
): OptimisticPatchSet {
  const patches = emptyPatchSet()
  for (const item of items) {
    for (const candidate of sourceTree(item, snapshot.trash)) {
      pushRemove(patches, candidate)
    }
  }
  return patches
}
