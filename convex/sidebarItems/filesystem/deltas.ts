import { ERROR_CODE, throwClientError } from '../../errors'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
  assertSidebarItemType,
} from '../types/baseTypes'
import { getSidebarItemStatus } from '../types/status'
import { collectDescendants } from '../functions/collectDescendants'
import { hardDeleteTree, restoreTreeDescendants, trashTree } from './treeWrites'
import { insertFilesystemSidebarItem } from './sidebarItemWriter'
import { diffSidebarItemFields, valuesMatch } from './patches'
import { assertSidebarItemColor } from '../validation/color'
import { assertSidebarItemIconName } from '../validation/icon'
import { assertSidebarItemName } from '../validation/name'
import { assertSidebarItemSlug } from '../validation/slug'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarOperationAllowed, evaluateTrash } from './capabilities'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'
import type { InsertFilesystemSidebarItemArgs } from './sidebarItemWriter'
import type {
  FileSystemDelta,
  FileSystemEvent,
  FileSystemPatch,
  SidebarItemFieldPatch,
} from './receipts'
import type { FileSystemCommand } from './commands'

type SidebarItemSnapshot = Doc<'sidebarItems'>

function toSidebarItemSnapshot(item: AnySidebarItemRow | SidebarItemSnapshot): SidebarItemSnapshot {
  return {
    _id: item._id,
    _creationTime: item._creationTime,
    campaignId: item.campaignId,
    name: assertSidebarItemName(item.name),
    slug: assertSidebarItemSlug(item.slug),
    iconName: item.iconName === null ? null : assertSidebarItemIconName(item.iconName),
    color: item.color === null ? null : assertSidebarItemColor(item.color),
    parentId: item.parentId,
    allPermissionLevel: item.allPermissionLevel,
    type: assertSidebarItemType(item.type),
    location: item.location,
    status: item.status,
    previewStorageId: item.previewStorageId,
    previewLockedUntil: item.previewLockedUntil,
    previewClaimToken: item.previewClaimToken,
    previewUpdatedAt: item.previewUpdatedAt,
    deletionTime: item.deletionTime,
    deletedBy: item.deletedBy,
    updatedTime: item.updatedTime,
    updatedBy: item.updatedBy,
    createdBy: item.createdBy,
  }
}

function lifecyclePatchFields(item: SidebarItemSnapshot): SidebarItemFieldPatch {
  return {
    location: item.location,
    status: item.status,
    deletionTime: item.deletionTime,
    deletedBy: item.deletedBy,
  }
}

function undoHiddenSidebarItemFields(): SidebarItemFieldPatch {
  return {
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.undoHidden,
    deletionTime: null,
    deletedBy: null,
  }
}

function snapshotsMatch(
  before: SidebarItemSnapshot | undefined,
  after: SidebarItemSnapshot | null,
) {
  if (before === after) return true
  if (!before || !after) return false
  const beforeKeys = Object.keys(before) as Array<keyof SidebarItemSnapshot>
  const afterKeys = Object.keys(after) as Array<keyof SidebarItemSnapshot>
  if (beforeKeys.length !== afterKeys.length) return false
  return beforeKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(after, key) && valuesMatch(before[key], after[key]),
  )
}

function pushChangedItemPatch(
  receiptPatches: Array<FileSystemPatch>,
  forwardPatches: Array<FileSystemPatch>,
  inversePatches: Array<FileSystemPatch>,
  itemId: Id<'sidebarItems'>,
  before: SidebarItemSnapshot,
  after: SidebarItemSnapshot,
) {
  const { changed, previous } = diffSidebarItemFields(before, after)
  if (Object.keys(changed).length === 0) return
  const patch = {
    type: 'updateSidebarItem' as const,
    itemId,
    before: previous,
    fields: changed,
  }
  receiptPatches.push(patch)
  forwardPatches.push(patch)
  inversePatches.push({
    type: 'updateSidebarItem',
    itemId,
    before: changed,
    fields: previous,
  })
}

function pushInsertedItemPatch(
  receiptPatches: Array<FileSystemPatch>,
  forwardPatches: Array<FileSystemPatch>,
  inversePatches: Array<FileSystemPatch>,
  itemId: Id<'sidebarItems'>,
  after: SidebarItemSnapshot,
) {
  const hidden = undoHiddenSidebarItemFields()
  const afterFields = lifecyclePatchFields(after)
  receiptPatches.push({ type: 'upsertSidebarItem', item: after })
  forwardPatches.push({
    type: 'updateSidebarItem',
    itemId,
    before: hidden,
    fields: afterFields,
  })
  inversePatches.push({
    type: 'updateSidebarItem',
    itemId,
    before: afterFields,
    fields: hidden,
  })
}

function pushRemovedItemPatch(
  receiptPatches: Array<FileSystemPatch>,
  itemId: Id<'sidebarItems'>,
  before: SidebarItemSnapshot,
) {
  receiptPatches.push({ type: 'removeSidebarItem', itemId, snapshot: before })
}

export type FileSystemWriteSession = {
  insertSidebarItem: (
    args: InsertFilesystemSidebarItemArgs,
  ) => Promise<{ itemId: Id<'sidebarItems'>; slug: string }>
  updateSidebarItem: (itemId: Id<'sidebarItems'>, fields: SidebarItemFieldPatch) => Promise<void>
  trashSidebarTree: (item: AnySidebarItem) => Promise<void>
  restoreSidebarTree: (item: AnySidebarItemRow, rootFields: SidebarItemFieldPatch) => Promise<void>
  deleteSidebarTree: (item: AnySidebarItemRow) => Promise<void>
  build: (args: {
    command: FileSystemCommand
    events: Array<FileSystemEvent>
    undoable?: boolean
  }) => Promise<FileSystemDelta>
}

async function collectTreeSnapshot(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemRow,
): Promise<Array<SidebarItemSnapshot>> {
  const items: Array<SidebarItemSnapshot> = [toSidebarItemSnapshot(item)]
  if (item.type !== SIDEBAR_ITEM_TYPES.folders) return items

  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    status: getSidebarItemStatus(item),
    folderId: item._id,
  })
  items.push(...descendants.map(toSidebarItemSnapshot))
  return items
}

export function createFileSystemWriteSession(ctx: CampaignMutationCtx): FileSystemWriteSession {
  const receiptPatches: Array<FileSystemPatch> = []
  const forwardPatches: Array<FileSystemPatch> = []
  const inversePatches: Array<FileSystemPatch> = []
  let hasRemovedRows = false

  const recordChangedItem = (
    itemId: Id<'sidebarItems'>,
    before: SidebarItemSnapshot,
    after: SidebarItemSnapshot | null,
  ) => {
    if (snapshotsMatch(before, after)) return
    if (after) {
      pushChangedItemPatch(receiptPatches, forwardPatches, inversePatches, itemId, before, after)
      return
    }
    hasRemovedRows = true
    pushRemovedItemPatch(receiptPatches, itemId, before)
  }

  const recordTreeUpdatePatches = (
    beforeItems: Array<SidebarItemSnapshot>,
    getAfter: (before: SidebarItemSnapshot) => SidebarItemSnapshot | null,
  ) => {
    for (const before of beforeItems) {
      recordChangedItem(before._id, before, getAfter(before))
    }
  }

  const updateSidebarItem: FileSystemWriteSession['updateSidebarItem'] = async (itemId, fields) => {
    const before = await ctx.db.get(itemId)
    if (!before) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    const after = { ...before, ...fields }
    if (snapshotsMatch(before, after)) return
    await ctx.db.patch('sidebarItems', itemId, fields)
    pushChangedItemPatch(receiptPatches, forwardPatches, inversePatches, itemId, before, after)
  }

  const insertSidebarItem: FileSystemWriteSession['insertSidebarItem'] = async (args) => {
    const inserted = await insertFilesystemSidebarItem(ctx, args)
    const itemId = inserted.itemId
    const item = await ctx.db.get(itemId)
    if (!item) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Inserted item not found')
    }
    pushInsertedItemPatch(receiptPatches, forwardPatches, inversePatches, itemId, item)
    return inserted
  }

  const trashSidebarTree: FileSystemWriteSession['trashSidebarTree'] = async (item) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    assertSidebarOperationAllowed(evaluateTrash({ role: ctx.membership.role }, item))
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
    recordTreeUpdatePatches(beforeItems, (before) => ({
      ...before,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
      status: SIDEBAR_ITEM_STATUS.trashed,
      deletionTime: deletion.deletionTime,
      deletedBy: deletion.deletedBy,
      parentId: before._id === item._id ? null : before.parentId,
    }))
  }

  const restoreSidebarTree: FileSystemWriteSession['restoreSidebarTree'] = async (
    item,
    rootFields,
  ) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    await ctx.db.patch('sidebarItems', item._id, rootFields)
    const afterById = new Map<Id<'sidebarItems'>, SidebarItemSnapshot>([
      [item._id, toSidebarItemSnapshot({ ...item, ...rootFields })],
    ])
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      const restoredDescendants = await restoreTreeDescendants(ctx, item)
      for (const descendant of restoredDescendants) {
        afterById.set(descendant._id, toSidebarItemSnapshot(descendant))
      }
    }
    recordTreeUpdatePatches(beforeItems, (before) => afterById.get(before._id) ?? before)
  }

  const deleteSidebarTree: FileSystemWriteSession['deleteSidebarTree'] = async (item) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    await hardDeleteTree(ctx, item)
    recordTreeUpdatePatches(beforeItems, () => null)
  }

  const build: FileSystemWriteSession['build'] = ({ command, events, undoable = true }) => {
    const canUndo = undoable && !hasRemovedRows && inversePatches.length > 0
    return Promise.resolve({
      command,
      events,
      receiptPatches,
      forwardPatches: canUndo ? forwardPatches : [],
      inversePatches: canUndo ? inversePatches : [],
      undoable: canUndo,
    })
  }

  return {
    insertSidebarItem,
    updateSidebarItem,
    trashSidebarTree,
    restoreSidebarTree,
    deleteSidebarTree,
    build,
  }
}

export function assertUndoablePatch(
  patch: FileSystemPatch,
): asserts patch is Extract<FileSystemPatch, { type: 'updateSidebarItem' }> {
  if (patch.type === 'updateSidebarItem') return
  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Filesystem patch is not undoable')
}
