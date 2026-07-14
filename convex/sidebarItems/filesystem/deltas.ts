import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
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
import { assertConvexResourceTitle } from '../validation/name'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarOperationAllowed, operationActorFromRole } from './capabilities'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { InsertFilesystemSidebarItemArgs } from './sidebarItemWriter'
import { toSidebarItemDocument, toSidebarItemReplacement } from '../types/status'
import { getAssetIdByStorageId, getStorageIdByAssetId } from '../../storage/functions/assetIdentity'
import {
  createSidebarItemShareIdentityProjection,
  projectSidebarItemShare,
} from '../../sidebarShares/functions/projectSidebarItemShare'
import {
  requireSidebarItemRow,
  sidebarItemParentResourceId,
  sidebarItemResourceId,
} from '../functions/sidebarItemIdentity'

type BookmarkStateChangeRow = {
  sidebarItemId: Id<'sidebarItems'>
  campaignMemberId: Id<'campaignMembers'>
}
export type StoredResourcePatchRow = Doc<'sidebarItems'>
export type StoredSidebarItemSharePatchRow = Doc<'sidebarItemShares'>
export type StoredFolderSharePatchRow = {
  folderId: Id<'sidebarItems'>
  inheritShares: boolean
}
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
  | {
      type: 'updateFolderShare'
      before: StoredFolderSharePatchRow
      after: StoredFolderSharePatchRow
    }
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
type StoredSidebarItemFieldPatch = Partial<
  Omit<Doc<'sidebarItems'>, '_id' | '_creationTime' | 'resourceUuid' | 'campaignId'>
>
type SidebarItemPatchPrecondition = Extract<ResourcePatch, { type: 'updateResource' }>['before']
type SidebarItemSharePatchRow = Extract<ResourcePatch, { type: 'upsertResourceShare' }>['share']

const UNDOABLE_UPDATE_FIELD_KEYS = [
  'name',
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

async function resourcePatchRowFromStored(
  ctx: CampaignMutationCtx,
  row: StoredResourcePatchRow,
  resourceIdsByRowId?: ReadonlyMap<Id<'sidebarItems'>, ResourceId>,
): Promise<ResourcePatchRow> {
  const {
    _id,
    _creationTime,
    resourceUuid: _resourceUuid,
    campaignId: _campaignRowId,
    normalizedName: _normalizedName,
    parentId,
    previewStorageId,
    previewUpdatedAt: _previewUpdatedAt,
    ...fields
  } = row
  return {
    ...fields,
    id: sidebarItemResourceId(row),
    parentId:
      parentId === null
        ? null
        : (resourceIdsByRowId?.get(parentId) ?? (await sidebarItemParentResourceId(ctx, parentId))),
    createdAt: _creationTime,
    workspaceId: assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid),
    previewAssetId: await getAssetIdByStorageId(ctx.db, previewStorageId),
  }
}

export async function storedSidebarItemPatchFields(
  ctx: CampaignMutationCtx,
  fields: SidebarItemFieldPatch,
) {
  const { parentId, previewAssetId, ...storedFields } = fields
  return {
    ...storedFields,
    ...(parentId !== undefined
      ? {
          parentId: parentId === null ? null : (await requireSidebarItemRow(ctx, parentId))._id,
        }
      : {}),
    ...(previewAssetId !== undefined
      ? { previewStorageId: await getStorageIdByAssetId(ctx.db, previewAssetId) }
      : {}),
  }
}

async function sidebarItemSharePatchRowFromStored(
  ctx: CampaignMutationCtx,
  row: StoredSidebarItemSharePatchRow,
): Promise<SidebarItemSharePatchRow> {
  const [member, session] = await Promise.all([
    ctx.db.get('campaignMembers', row.campaignMemberId),
    row.sessionId ? ctx.db.get('sessions', row.sessionId) : null,
  ])
  if (
    !member ||
    member.campaignId !== ctx.campaign._id ||
    (row.sessionId && (!session || session.campaignId !== ctx.campaign._id))
  ) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  const resource = await ctx.db.get('sidebarItems', row.sidebarItemId)
  if (!resource || resource.campaignId !== ctx.campaign._id) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Filesystem transaction can no longer be applied cleanly',
    )
  }
  const share = projectSidebarItemShare(
    row,
    createSidebarItemShareIdentityProjection(ctx.campaign, [member], session ? [session] : []),
    sidebarItemResourceId(resource),
  )
  return {
    id: share.id,
    createdAt: share.createdAt,
    workspaceId: share.campaignId,
    resourceId: share.sidebarItemId,
    sidebarItemType: share.sidebarItemType,
    memberId: share.campaignMemberId,
    sessionId: share.sessionId,
    permissionLevel: share.permissionLevel,
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

async function storedResourceId(ctx: CampaignMutationCtx, itemId: Id<'sidebarItems'>) {
  const item = await ctx.db.get('sidebarItems', itemId)
  if (!item || item.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Resource not found')
  }
  return sidebarItemResourceId(item)
}

async function changedItemPatch(
  ctx: CampaignMutationCtx,
  before: StoredResourcePatchRow,
  after: StoredResourcePatchRow,
  resourceIdsByRowId: ReadonlyMap<Id<'sidebarItems'>, ResourceId>,
) {
  const { changed, previous } = diffResourceFields(
    await resourcePatchRowFromStored(ctx, before, resourceIdsByRowId),
    await resourcePatchRowFromStored(ctx, after, resourceIdsByRowId),
  )
  if (Object.keys(changed).length === 0) return null
  return {
    type: 'updateResource' as const,
    itemId: sidebarItemResourceId(before),
    before: previous,
    fields: changed,
  }
}

async function changedUndoableItemPatch(
  ctx: CampaignMutationCtx,
  before: StoredResourcePatchRow,
  after: StoredResourcePatchRow,
  resourceIdsByRowId: ReadonlyMap<Id<'sidebarItems'>, ResourceId>,
) {
  const [publicBefore, publicAfter] = await Promise.all([
    resourcePatchRowFromStored(ctx, before, resourceIdsByRowId),
    resourcePatchRowFromStored(ctx, after, resourceIdsByRowId),
  ])
  const fields: SidebarItemFieldPatch = {}
  const precondition: SidebarItemFieldPatch = {}

  for (const key of UNDOABLE_UPDATE_FIELD_KEYS) {
    if (valuesMatch(publicBefore[key], publicAfter[key])) continue
    setPatchField(fields, key, publicAfter[key])
    setPatchField(precondition, key, publicBefore[key])
  }

  if (Object.keys(fields).length === 0) return null
  return {
    type: 'updateResource' as const,
    itemId: publicBefore.id,
    before: precondition,
    fields,
  }
}

async function changedSharePatch(
  ctx: CampaignMutationCtx,
  before: StoredSidebarItemSharePatchRow,
  after: StoredSidebarItemSharePatchRow,
) {
  const [publicBefore, publicAfter] = await Promise.all([
    sidebarItemSharePatchRowFromStored(ctx, before),
    sidebarItemSharePatchRowFromStored(ctx, after),
  ])
  const diff = diffResourceShareFields(publicBefore, publicAfter)
  if (!diff) return null
  return {
    type: 'updateResourceShare' as const,
    resourceId: publicBefore.resourceId,
    memberId: publicBefore.memberId,
    before: diff.previous,
    fields: diff.changed,
  }
}

async function changedFolderSharePatch(
  ctx: CampaignMutationCtx,
  before: StoredFolderSharePatchRow,
  after: StoredFolderSharePatchRow,
) {
  const publicBefore: FolderSharePatchRow = {
    folderId: await storedResourceId(ctx, before.folderId),
    inheritShares: before.inheritShares,
  }
  const publicAfter: FolderSharePatchRow = {
    folderId: publicBefore.folderId,
    inheritShares: after.inheritShares,
  }
  const diff = diffFolderShareFields(publicBefore, publicAfter)
  if (!diff) return null
  return {
    type: 'updateFolderShare' as const,
    folderId: publicBefore.folderId,
    before: diff.previous,
    fields: diff.changed,
  }
}

function insertedItemForwardPatch(after: StoredResourcePatchRow): ResourcePatch {
  const hidden = undoHiddenSidebarItemFields()
  const afterFields = lifecyclePatchFields(after)
  return {
    type: 'updateResource',
    itemId: sidebarItemResourceId(after),
    before: hidden,
    fields: afterFields,
  }
}

async function insertedItemInversePatch(
  ctx: CampaignMutationCtx,
  after: StoredResourcePatchRow,
  resourceIdsByRowId: ReadonlyMap<Id<'sidebarItems'>, ResourceId>,
): Promise<ResourcePatch> {
  return {
    type: 'updateResource',
    itemId: sidebarItemResourceId(after),
    before: await insertedItemUndoPrecondition(ctx, after, resourceIdsByRowId),
    fields: undoHiddenSidebarItemFields(),
  }
}

async function insertedItemUndoPrecondition(
  ctx: CampaignMutationCtx,
  after: StoredResourcePatchRow,
  resourceIdsByRowId: ReadonlyMap<Id<'sidebarItems'>, ResourceId>,
): Promise<SidebarItemPatchPrecondition> {
  return {
    type: after.type,
    name: assertConvexResourceTitle(after.name),
    iconName: after.iconName === null ? null : assertResourceIconName(after.iconName),
    color: after.color === null ? null : assertResourceColor(after.color),
    parentId:
      after.parentId === null
        ? null
        : (resourceIdsByRowId.get(after.parentId) ??
          (await sidebarItemParentResourceId(ctx, after.parentId))),
    status: after.status,
    deletionTime: after.deletionTime,
    deletedBy: after.deletedBy,
    createdBy: after.createdBy,
  }
}

function resourceIdentityProjectionFromChangeSet(changes: Array<StoredFileSystemChange>) {
  const resourceIdsByRowId = new Map<Id<'sidebarItems'>, ResourceId>()
  for (const change of changes) {
    switch (change.type) {
      case 'insertResource':
        resourceIdsByRowId.set(change.after._id, sidebarItemResourceId(change.after))
        break
      case 'updateResource':
        resourceIdsByRowId.set(change.before._id, sidebarItemResourceId(change.before))
        resourceIdsByRowId.set(change.after._id, sidebarItemResourceId(change.after))
        break
      case 'removeResource':
        resourceIdsByRowId.set(change.before._id, sidebarItemResourceId(change.before))
        break
    }
  }
  return resourceIdsByRowId
}

export async function receiptPatchesFromChangeSet(
  ctx: CampaignMutationCtx,
  changes: Array<StoredFileSystemChange>,
) {
  const resourceIdsByRowId = resourceIdentityProjectionFromChangeSet(changes)
  const patches = await Promise.all(
    changes.map(async (change): Promise<ResourcePatch | null> => {
      switch (change.type) {
        case 'insertResource':
          return {
            type: 'upsertResource',
            item: await resourcePatchRowFromStored(ctx, change.after, resourceIdsByRowId),
          }
        case 'updateResource':
          return await changedItemPatch(ctx, change.before, change.after, resourceIdsByRowId)
        case 'removeResource':
          return {
            type: 'removeResource',
            itemId: sidebarItemResourceId(change.before),
            snapshot: await resourcePatchRowFromStored(ctx, change.before, resourceIdsByRowId),
          }
        case 'insertResourceShare':
          return {
            type: 'upsertResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.after),
          }
        case 'updateResourceShare':
          return await changedSharePatch(ctx, change.before, change.after)
        case 'removeResourceShare':
          return {
            type: 'removeResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.before),
          }
        case 'updateFolderShare':
          return await changedFolderSharePatch(ctx, change.before, change.after)
        case 'updateResourceBookmarkState':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.itemId),
            isBookmarked: change.after,
          }
        case 'insertBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.after.sidebarItemId),
            isBookmarked: true,
          }
        case 'removeBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.before.sidebarItemId),
            isBookmarked: false,
          }
      }
      return null
    }),
  )
  return patches.filter((patch): patch is ResourcePatch => patch !== null)
}

export async function redoPatchesFromChangeSet(
  ctx: CampaignMutationCtx,
  changes: Array<StoredFileSystemChange>,
) {
  const resourceIdsByRowId = resourceIdentityProjectionFromChangeSet(changes)
  const patches = await Promise.all(
    changes.map(async (change): Promise<ResourcePatch | null> => {
      switch (change.type) {
        case 'insertResource':
          return insertedItemForwardPatch(change.after)
        case 'updateResource':
          return await changedUndoableItemPatch(
            ctx,
            change.before,
            change.after,
            resourceIdsByRowId,
          )
        case 'insertResourceShare':
          return {
            type: 'upsertResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.after),
          }
        case 'updateResourceShare':
          return await changedSharePatch(ctx, change.before, change.after)
        case 'removeResourceShare':
          return {
            type: 'removeResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.before),
          }
        case 'updateFolderShare':
          return await changedFolderSharePatch(ctx, change.before, change.after)
        case 'updateResourceBookmarkState':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.itemId),
            isBookmarked: change.after,
          }
        case 'insertBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.after.sidebarItemId),
            isBookmarked: true,
          }
        case 'removeBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.before.sidebarItemId),
            isBookmarked: false,
          }
      }
      return null
    }),
  )
  return patches.filter((patch): patch is ResourcePatch => patch !== null)
}

export async function undoPatchesFromChangeSet(
  ctx: CampaignMutationCtx,
  changes: Array<StoredFileSystemChange>,
) {
  const resourceIdsByRowId = resourceIdentityProjectionFromChangeSet(changes)
  const patches = await Promise.all(
    changes.map(async (change): Promise<ResourcePatch | null> => {
      switch (change.type) {
        case 'insertResource':
          return await insertedItemInversePatch(ctx, change.after, resourceIdsByRowId)
        case 'updateResource':
          return await changedUndoableItemPatch(
            ctx,
            change.after,
            change.before,
            resourceIdsByRowId,
          )
        case 'insertResourceShare':
          return {
            type: 'removeResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.after),
          }
        case 'updateResourceShare':
          return await changedSharePatch(ctx, change.after, change.before)
        case 'removeResourceShare':
          return {
            type: 'upsertResourceShare',
            share: await sidebarItemSharePatchRowFromStored(ctx, change.before),
          }
        case 'updateFolderShare':
          return await changedFolderSharePatch(ctx, change.after, change.before)
        case 'updateResourceBookmarkState':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.itemId),
            isBookmarked: change.before,
          }
        case 'insertBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.after.sidebarItemId),
            isBookmarked: false,
          }
        case 'removeBookmark':
          return {
            type: 'setResourceBookmarkState',
            itemId: await storedResourceId(ctx, change.before.sidebarItemId),
            isBookmarked: true,
          }
      }
      return null
    }),
  )
  return patches.filter((patch): patch is ResourcePatch => patch !== null)
}

export function deletedForeverEvent(item: StoredResourcePatchRow): ResourceEvent {
  return {
    type: RESOURCE_EVENT_TYPE.deletedForever,
    itemId: sidebarItemResourceId(item),
  }
}

function changeSetIsUndoable(changes: Array<StoredFileSystemChange>) {
  return changes.length > 0 && changes.every((change) => change.type !== 'removeResource')
}

export type FileSystemWriteSession = {
  insertResource: (
    args: InsertFilesystemSidebarItemArgs,
  ) => Promise<{ itemId: Id<'sidebarItems'>; resourceId: ResourcePatchRow['id'] }>
  updateResource: (itemId: Id<'sidebarItems'>, fields: StoredSidebarItemFieldPatch) => Promise<void>
  trashSidebarTree: (item: StoredResourcePatchRow) => Promise<void>
  restoreSidebarTree: (
    item: StoredResourcePatchRow,
    rootFields: StoredSidebarItemFieldPatch,
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
  recordFolderShareChange: (
    before: StoredFolderSharePatchRow,
    after: StoredFolderSharePatchRow,
  ) => void
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
    const after = toSidebarItemDocument({ ...before, ...fields })
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
      evaluateTrash(
        operationActorFromRole(ctx.membership.role),
        await resourcePatchRowFromStored(ctx, item),
      ),
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
