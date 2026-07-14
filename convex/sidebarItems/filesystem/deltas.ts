import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import {
  assertResourceColor,
  assertResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { collectDescendants } from '../functions/collectDescendants'
import { hardDeleteTree, restoreTreeDescendants, trashTree } from './treeWrites'
import type { TrashTreePatch } from './treeWrites'
import { insertFilesystemSidebarItem } from './sidebarItemWriter'
import {
  diffFolderShareFields,
  diffResourceFields,
  diffResourceShareFields,
  setPatchField,
  valuesMatch,
} from '@wizard-archive/editor/resources/patch-contract'
import { evaluateTrash } from '@wizard-archive/editor/resources/operation-capabilities'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type {
  ResourceCommand,
  ResourceEvent,
} from '@wizard-archive/editor/resources/transaction-contract'
import type {
  ResourceChange,
  ResourcePatch,
  ResourcePatchRow,
} from '@wizard-archive/editor/resources/patch-contract'
import { assertConvexSidebarItemName } from '../validation/name'
import { assertConvexSidebarItemSlug } from '../validation/slug'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarOperationAllowed, operationActorFromRole } from './capabilities'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { InsertFilesystemSidebarItemArgs } from './sidebarItemWriter'
import type { AssetId } from '../../../shared/common/ids'
import { toSidebarItemDocument, toSidebarItemReplacement } from '../types/status'

type BookmarkStateChangeRow = {
  sidebarItemId: Id<'sidebarItems'>
  campaignMemberId: Id<'campaignMembers'>
}
export type StoredResourcePatchRow = Doc<'sidebarItems'>
export type StoredSidebarItemSharePatchRow = Doc<'sidebarItemShares'>
type LegacyBookmarkChange =
  | { type: 'insertBookmark'; after: BookmarkStateChangeRow }
  | { type: 'removeBookmark'; before: BookmarkStateChangeRow }
type StoredFileSystemChange =
  | { type: 'insertResource'; itemId: Id<'sidebarItems'>; after: StoredResourcePatchRow }
  | {
      type: 'updateResource'
      itemId: Id<'sidebarItems'>
      before: StoredResourcePatchRow
      after: StoredResourcePatchRow
    }
  | { type: 'removeResource'; itemId: Id<'sidebarItems'>; before: StoredResourcePatchRow }
  | { type: 'insertResourceShare'; after: StoredSidebarItemSharePatchRow }
  | {
      type: 'updateResourceShare'
      before: StoredSidebarItemSharePatchRow
      after: StoredSidebarItemSharePatchRow
    }
  | { type: 'removeResourceShare'; before: StoredSidebarItemSharePatchRow }
  | Extract<ResourceChange, { type: 'updateFolderShare' }>
  | {
      type: 'updateResourceBookmarkState'
      itemId: Id<'sidebarItems'>
      campaignMemberId: Id<'campaignMembers'>
      before: boolean
      after: boolean
    }
  | LegacyBookmarkChange
export type StoredResourceDelta = {
  command: ResourceCommand
  events: Array<ResourceEvent>
  changes: Array<StoredFileSystemChange>
  undoable: boolean
}
type FolderSharePatchRow = Extract<ResourceChange, { type: 'updateFolderShare' }>['before']
type SidebarItemFieldPatch = Extract<ResourcePatch, { type: 'updateResource' }>['fields']
type SidebarItemPatchPrecondition = Extract<ResourcePatch, { type: 'updateResource' }>['before']
type SidebarItemSharePatchRow = Extract<ResourcePatch, { type: 'upsertResourceShare' }>['share']

const UNDOABLE_UPDATE_FIELD_KEYS = [
  'name',
  'slug',
  'iconName',
  'color',
  'parentId',
  'status',
  'allPermissionLevel',
  'deletionTime',
  'deletedBy',
] as const satisfies ReadonlyArray<keyof SidebarItemFieldPatch>

const UNDOABLE_PATCH_TYPES = [
  'updateResource',
  'updateResourceShare',
  'removeResourceShare',
  'upsertResourceShare',
  'updateFolderShare',
  'setResourceBookmarkState',
] as const satisfies ReadonlyArray<ResourcePatch['type']>

type UndoableFileSystemPatch = Extract<
  ResourcePatch,
  { type: (typeof UNDOABLE_PATCH_TYPES)[number] }
>

function assetIdFromStorageId(storageId: Id<'_storage'> | null): AssetId | null {
  return storageId as unknown as AssetId | null
}

function storageIdFromAssetId(assetId: AssetId | null): Id<'_storage'> | null {
  return assetId as unknown as Id<'_storage'> | null
}

function resourcePatchRowFromStored(row: StoredResourcePatchRow): ResourcePatchRow {
  const {
    _id,
    _creationTime,
    campaignId,
    normalizedName: _normalizedName,
    previewStorageId,
    previewUpdatedAt: _previewUpdatedAt,
    ...fields
  } = row
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
    workspaceId: campaignId,
    previewAssetId: assetIdFromStorageId(previewStorageId),
  }
}

export function storedSidebarItemPatchFields(fields: SidebarItemFieldPatch) {
  const { previewAssetId, ...storedFields } = fields
  return {
    ...storedFields,
    ...(previewAssetId !== undefined
      ? { previewStorageId: storageIdFromAssetId(previewAssetId) }
      : {}),
  }
}

function sidebarItemSharePatchRowFromStored(
  row: StoredSidebarItemSharePatchRow,
): SidebarItemSharePatchRow {
  const {
    _id: _rowId,
    _creationTime,
    resourceShareUuid,
    campaignId,
    campaignMemberId,
    sidebarItemId,
    ...fields
  } = row
  return {
    ...fields,
    id: resourceShareUuid,
    createdAt: _creationTime,
    workspaceId: campaignId,
    memberId: campaignMemberId,
    resourceId: sidebarItemId,
  }
}

function lifecyclePatchFields(item: StoredResourcePatchRow): SidebarItemFieldPatch {
  return {
    status: item.status,
    deletionTime: item.deletionTime,
    deletedBy: item.deletedBy,
  }
}

function undoHiddenSidebarItemFields(): SidebarItemFieldPatch {
  return {
    status: RESOURCE_STATUS.undoHidden,
    deletionTime: null,
    deletedBy: null,
  }
}

function snapshotsMatch(
  before: StoredResourcePatchRow | undefined,
  after: StoredResourcePatchRow | null,
) {
  if (before === after) return true
  if (!before || !after) return false
  const beforeKeys = Object.keys(before) as Array<keyof StoredResourcePatchRow>
  const afterKeys = Object.keys(after) as Array<keyof StoredResourcePatchRow>
  if (beforeKeys.length !== afterKeys.length) return false
  return beforeKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(after, key) && valuesMatch(before[key], after[key]),
  )
}

function changedItemPatch(before: StoredResourcePatchRow, after: StoredResourcePatchRow) {
  const { changed, previous } = diffResourceFields(
    resourcePatchRowFromStored(before),
    resourcePatchRowFromStored(after),
  )
  if (Object.keys(changed).length === 0) return null
  return {
    type: 'updateResource' as const,
    itemId: before._id,
    before: previous,
    fields: changed,
  }
}

function changedUndoableItemPatch(before: StoredResourcePatchRow, after: StoredResourcePatchRow) {
  const fields: SidebarItemFieldPatch = {}
  const precondition: SidebarItemFieldPatch = {}

  for (const key of UNDOABLE_UPDATE_FIELD_KEYS) {
    if (valuesMatch(before[key], after[key])) continue
    setPatchField(fields, key, after[key])
    setPatchField(precondition, key, before[key])
  }

  if (Object.keys(fields).length === 0) return null
  return {
    type: 'updateResource' as const,
    itemId: before._id,
    before: precondition,
    fields,
  }
}

function changedSharePatch(
  before: StoredSidebarItemSharePatchRow,
  after: StoredSidebarItemSharePatchRow,
) {
  const publicBefore = sidebarItemSharePatchRowFromStored(before)
  const publicAfter = sidebarItemSharePatchRowFromStored(after)
  const diff = diffResourceShareFields(publicBefore, publicAfter)
  if (!diff) return null
  return {
    type: 'updateResourceShare' as const,
    resourceId: before.sidebarItemId,
    memberId: publicBefore.memberId,
    before: diff.previous,
    fields: diff.changed,
  }
}

function changedFolderSharePatch(before: FolderSharePatchRow, after: FolderSharePatchRow) {
  const diff = diffFolderShareFields(before, after)
  if (!diff) return null
  return {
    type: 'updateFolderShare' as const,
    folderId: before.folderId,
    before: diff.previous,
    fields: diff.changed,
  }
}

function insertedItemForwardPatch(after: StoredResourcePatchRow): ResourcePatch {
  const hidden = undoHiddenSidebarItemFields()
  const afterFields = lifecyclePatchFields(after)
  return {
    type: 'updateResource',
    itemId: after._id,
    before: hidden,
    fields: afterFields,
  }
}

function insertedItemInversePatch(after: StoredResourcePatchRow): ResourcePatch {
  return {
    type: 'updateResource',
    itemId: after._id,
    before: insertedItemUndoPrecondition(after),
    fields: undoHiddenSidebarItemFields(),
  }
}

function insertedItemUndoPrecondition(after: StoredResourcePatchRow): SidebarItemPatchPrecondition {
  return {
    type: after.type,
    name: assertConvexSidebarItemName(after.name),
    slug: assertConvexSidebarItemSlug(after.slug),
    iconName: after.iconName === null ? null : assertResourceIconName(after.iconName),
    color: after.color === null ? null : assertResourceColor(after.color),
    parentId: after.parentId,
    status: after.status,
    deletionTime: after.deletionTime,
    deletedBy: after.deletedBy,
    createdBy: after.createdBy,
  }
}

export function receiptPatchesFromChangeSet(changes: Array<StoredFileSystemChange>) {
  const patches: Array<ResourcePatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertResource':
        patches.push({ type: 'upsertResource', item: resourcePatchRowFromStored(change.after) })
        break
      case 'updateResource': {
        const patch = changedItemPatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'removeResource':
        patches.push({
          type: 'removeResource',
          itemId: change.itemId,
          snapshot: resourcePatchRowFromStored(change.before),
        })
        break
      case 'insertResourceShare':
        patches.push({
          type: 'upsertResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.after),
        })
        break
      case 'updateResourceShare': {
        const patch = changedSharePatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'removeResourceShare':
        patches.push({
          type: 'removeResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.before),
        })
        break
      case 'updateFolderShare': {
        const patch = changedFolderSharePatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'updateResourceBookmarkState':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.itemId,
          isBookmarked: change.after,
        })
        break
      case 'insertBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.after.sidebarItemId,
          isBookmarked: true,
        })
        break
      case 'removeBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.before.sidebarItemId,
          isBookmarked: false,
        })
        break
    }
  }
  return patches
}

export function redoPatchesFromChangeSet(changes: Array<StoredFileSystemChange>) {
  const patches: Array<ResourcePatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertResource':
        patches.push(insertedItemForwardPatch(change.after))
        break
      case 'updateResource': {
        const patch = changedUndoableItemPatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'insertResourceShare':
        patches.push({
          type: 'upsertResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.after),
        })
        break
      case 'updateResourceShare': {
        const patch = changedSharePatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'removeResourceShare':
        patches.push({
          type: 'removeResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.before),
        })
        break
      case 'updateFolderShare': {
        const patch = changedFolderSharePatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'updateResourceBookmarkState':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.itemId,
          isBookmarked: change.after,
        })
        break
      case 'insertBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.after.sidebarItemId,
          isBookmarked: true,
        })
        break
      case 'removeBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.before.sidebarItemId,
          isBookmarked: false,
        })
        break
    }
  }
  return patches
}

export function undoPatchesFromChangeSet(changes: Array<StoredFileSystemChange>) {
  const patches: Array<ResourcePatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertResource':
        patches.push(insertedItemInversePatch(change.after))
        break
      case 'updateResource': {
        const patch = changedUndoableItemPatch(change.after, change.before)
        if (patch) patches.push(patch)
        break
      }
      case 'insertResourceShare':
        patches.push({
          type: 'removeResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.after),
        })
        break
      case 'updateResourceShare': {
        const patch = changedSharePatch(change.after, change.before)
        if (patch) patches.push(patch)
        break
      }
      case 'removeResourceShare':
        patches.push({
          type: 'upsertResourceShare',
          share: sidebarItemSharePatchRowFromStored(change.before),
        })
        break
      case 'updateFolderShare': {
        const patch = changedFolderSharePatch(change.after, change.before)
        if (patch) patches.push(patch)
        break
      }
      case 'updateResourceBookmarkState':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.itemId,
          isBookmarked: change.before,
        })
        break
      case 'insertBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.after.sidebarItemId,
          isBookmarked: false,
        })
        break
      case 'removeBookmark':
        patches.push({
          type: 'setResourceBookmarkState',
          itemId: change.before.sidebarItemId,
          isBookmarked: true,
        })
        break
    }
  }
  return patches
}

export function deletedForeverEvent(itemId: Id<'sidebarItems'>): ResourceEvent {
  return {
    type: RESOURCE_EVENT_TYPE.deletedForever,
    itemId,
  }
}

function changeSetIsUndoable(changes: Array<StoredFileSystemChange>) {
  return changes.length > 0 && changes.every((change) => change.type !== 'removeResource')
}

export type FileSystemWriteSession = {
  insertResource: (
    args: InsertFilesystemSidebarItemArgs,
  ) => Promise<{ itemId: Id<'sidebarItems'>; slug: string }>
  updateResource: (itemId: Id<'sidebarItems'>, fields: SidebarItemFieldPatch) => Promise<void>
  trashSidebarTree: (item: StoredResourcePatchRow) => Promise<void>
  restoreSidebarTree: (
    item: StoredResourcePatchRow,
    rootFields: SidebarItemFieldPatch,
  ) => Promise<void>
  deleteSidebarTree: (item: StoredResourcePatchRow) => Promise<void>
  recordSidebarItemChange: (
    before: StoredResourcePatchRow,
    after: StoredResourcePatchRow | null,
  ) => void
  recordSidebarItemShareChange: (
    before: StoredSidebarItemSharePatchRow | null,
    after: StoredSidebarItemSharePatchRow | null,
  ) => void
  recordFolderShareChange: (before: FolderSharePatchRow, after: FolderSharePatchRow) => void
  recordBookmarkChange: (
    before: BookmarkStateChangeRow | null,
    after: BookmarkStateChangeRow | null,
  ) => void
  build: (args: {
    command: ResourceCommand
    events: Array<ResourceEvent>
    undoable?: boolean
  }) => Promise<StoredResourceDelta>
}

async function collectTreeSnapshot(
  ctx: CampaignMutationCtx,
  item: StoredResourcePatchRow,
): Promise<Array<StoredResourcePatchRow>> {
  const root = await ctx.db.get('sidebarItems', item._id)
  if (!root) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }
  const items: Array<StoredResourcePatchRow> = [root]
  if (root.type !== RESOURCE_TYPES.folders) return items

  const descendants = await collectDescendants(ctx, {
    campaignId: root.campaignId,
    status: root.status,
    folderId: root._id,
  })
  items.push(...descendants)
  return items
}

export function createFileSystemWriteSession(ctx: CampaignMutationCtx): FileSystemWriteSession {
  const changes: Array<StoredFileSystemChange> = []

  const recordChangedItem = (
    itemId: Id<'sidebarItems'>,
    before: StoredResourcePatchRow,
    after: StoredResourcePatchRow | null,
  ) => {
    if (snapshotsMatch(before, after)) return
    if (after) {
      changes.push({ type: 'updateResource', itemId, before, after })
      return
    }
    changes.push({ type: 'removeResource', itemId, before })
  }

  const recordSidebarItemChange: FileSystemWriteSession['recordSidebarItemChange'] = (
    before,
    after,
  ) => {
    recordChangedItem(before._id, before, after)
  }

  const recordTreeUpdatePatches = (
    beforeItems: Array<StoredResourcePatchRow>,
    getAfter: (before: StoredResourcePatchRow) => StoredResourcePatchRow | null,
  ) => {
    for (const before of beforeItems) {
      recordChangedItem(before._id, before, getAfter(before))
    }
  }

  const updateResource: FileSystemWriteSession['updateResource'] = async (itemId, fields) => {
    const before = await ctx.db.get('sidebarItems', itemId)
    if (!before) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    const storedFields = storedSidebarItemPatchFields(fields)
    const after = toSidebarItemDocument({ ...before, ...storedFields })
    const beforeSnapshot = before
    if (snapshotsMatch(beforeSnapshot, after)) return
    await ctx.db.replace('sidebarItems', itemId, toSidebarItemReplacement(after))
    changes.push({ type: 'updateResource', itemId, before: beforeSnapshot, after })
  }

  const insertResource: FileSystemWriteSession['insertResource'] = async (args) => {
    const inserted = await insertFilesystemSidebarItem(ctx, args)
    const itemId = inserted.itemId
    const item = await ctx.db.get('sidebarItems', itemId)
    if (!item) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Inserted item not found')
    }
    changes.push({ type: 'insertResource', itemId, after: item })
    return inserted
  }

  const trashSidebarTree: FileSystemWriteSession['trashSidebarTree'] = async (item) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    assertSidebarOperationAllowed(
      evaluateTrash(operationActorFromRole(ctx.membership.role), resourcePatchRowFromStored(item)),
    )
    const deletion = {
      deletionTime: Date.now(),
      deletedBy: ctx.membership.userId,
    }
    await trashTree(ctx, item, {
      deletionTime: deletion.deletionTime,
      deletedBy: deletion.deletedBy,
    })
    await logEditHistory(ctx, {
      itemId: item._id,
      itemType: item.type,
      action: EDIT_HISTORY_ACTION.trashed,
    })
    recordTreeUpdatePatches(beforeItems, (before) => {
      const patch: TrashTreePatch = {
        status: RESOURCE_STATUS.trashed,
        deletionTime: deletion.deletionTime,
        deletedBy: deletion.deletedBy,
        parentId: before._id === item._id ? null : before.parentId,
      }
      return toSidebarItemDocument({ ...before, ...patch })
    })
  }

  const restoreSidebarTree: FileSystemWriteSession['restoreSidebarTree'] = async (
    item,
    rootFields,
  ) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    const rootBefore = beforeItems[0]
    if (!rootBefore) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    const rootAfter = toSidebarItemDocument({ ...rootBefore, ...rootFields })
    await ctx.db.replace('sidebarItems', item._id, toSidebarItemReplacement(rootAfter))
    const afterById = new Map<Id<'sidebarItems'>, Doc<'sidebarItems'>>([[item._id, rootAfter]])
    if (item.type === RESOURCE_TYPES.folders) {
      const restoredDescendants = await restoreTreeDescendants(ctx, item)
      for (const descendant of restoredDescendants) {
        afterById.set(descendant._id, descendant)
      }
    }
    recordTreeUpdatePatches(beforeItems, (before) => {
      const after = afterById.get(before._id)
      if (!after) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Restored tree state is incomplete')
      }
      return after
    })
  }

  const deleteSidebarTree: FileSystemWriteSession['deleteSidebarTree'] = async (item) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    await hardDeleteTree(ctx, item)
    recordTreeUpdatePatches(beforeItems, () => null)
  }

  const recordSidebarItemShareChange: FileSystemWriteSession['recordSidebarItemShareChange'] = (
    before,
    after,
  ) => {
    if (before && after) {
      if (!valuesMatch(before, after)) {
        changes.push({ type: 'updateResourceShare', before, after })
      }
      return
    }
    if (after) {
      changes.push({ type: 'insertResourceShare', after })
      return
    }
    if (before) {
      changes.push({ type: 'removeResourceShare', before })
    }
  }

  const recordFolderShareChange: FileSystemWriteSession['recordFolderShareChange'] = (
    before,
    after,
  ) => {
    if (!valuesMatch(before, after)) {
      changes.push({ type: 'updateFolderShare', before, after })
    }
  }

  const recordBookmarkChange: FileSystemWriteSession['recordBookmarkChange'] = (before, after) => {
    const row = after ?? before
    if (!row) return
    const wasBookmarked = before !== null
    const isBookmarked = after !== null
    if (wasBookmarked === isBookmarked) return
    changes.push({
      type: 'updateResourceBookmarkState',
      itemId: row.sidebarItemId,
      campaignMemberId: row.campaignMemberId,
      before: wasBookmarked,
      after: isBookmarked,
    })
  }

  const build: FileSystemWriteSession['build'] = ({ command, events, undoable = true }) => {
    const canUndo = undoable && changeSetIsUndoable(changes)
    return Promise.resolve({
      command,
      events,
      changes,
      undoable: canUndo,
    })
  }

  return {
    insertResource,
    updateResource,
    trashSidebarTree,
    restoreSidebarTree,
    deleteSidebarTree,
    recordSidebarItemChange,
    recordSidebarItemShareChange,
    recordFolderShareChange,
    recordBookmarkChange,
    build,
  }
}

export function assertUndoablePatch(
  patch: ResourcePatch,
): asserts patch is UndoableFileSystemPatch {
  if ((UNDOABLE_PATCH_TYPES as ReadonlyArray<string>).includes(patch.type)) return
  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Filesystem patch is not undoable')
}
