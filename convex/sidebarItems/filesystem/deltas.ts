import { ERROR_CODE, throwClientError } from '../../errors'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { collectDescendants } from '../functions/collectDescendants'
import { hardDeleteTree, restoreTreeDescendants, trashTree } from './treeWrites'
import type { TrashTreePatch } from './treeWrites'
import { insertFilesystemSidebarItem } from './sidebarItemWriter'
import { diffSidebarItemFields, setPatchField, valuesMatch } from './patches'
import { assertSidebarItemColor } from '../../../shared/sidebar-items/color'
import { assertSidebarItemIconName } from '../../../shared/sidebar-items/icon'
import { assertSidebarItemName } from '../validation/name'
import { assertSidebarItemSlug } from '../validation/slug'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarOperationAllowed, evaluateTrash } from './capabilities'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { AnySidebarItemRow } from '../types/types'
import type { InsertFilesystemSidebarItemArgs } from './sidebarItemWriter'
import type {
  FileSystemChange,
  FileSystemDelta,
  FileSystemEvent,
  FileSystemPatch,
  SidebarItemFieldPatch,
  SidebarItemPatchPrecondition,
} from './receipts'
import type { FileSystemCommand } from './commands'

const UNDOABLE_UPDATE_FIELD_KEYS = [
  'name',
  'slug',
  'iconName',
  'color',
  'parentId',
  'status',
  'deletionTime',
  'deletedBy',
] as const satisfies ReadonlyArray<keyof SidebarItemFieldPatch>

function lifecyclePatchFields(item: Doc<'sidebarItems'>): SidebarItemFieldPatch {
  return {
    status: item.status,
    deletionTime: item.deletionTime,
    deletedBy: item.deletedBy,
  }
}

function undoHiddenSidebarItemFields(): SidebarItemFieldPatch {
  return {
    status: SIDEBAR_ITEM_STATUS.undoHidden,
    deletionTime: null,
    deletedBy: null,
  }
}

function snapshotsMatch(
  before: Doc<'sidebarItems'> | undefined,
  after: Doc<'sidebarItems'> | null,
) {
  if (before === after) return true
  if (!before || !after) return false
  const beforeKeys = Object.keys(before) as Array<keyof Doc<'sidebarItems'>>
  const afterKeys = Object.keys(after) as Array<keyof Doc<'sidebarItems'>>
  if (beforeKeys.length !== afterKeys.length) return false
  return beforeKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(after, key) && valuesMatch(before[key], after[key]),
  )
}

function changedItemPatch(before: Doc<'sidebarItems'>, after: Doc<'sidebarItems'>) {
  const { changed, previous } = diffSidebarItemFields(before, after)
  if (Object.keys(changed).length === 0) return null
  return {
    type: 'updateSidebarItem' as const,
    itemId: before._id,
    before: previous,
    fields: changed,
  }
}

function changedUndoableItemPatch(before: Doc<'sidebarItems'>, after: Doc<'sidebarItems'>) {
  const fields: SidebarItemFieldPatch = {}
  const precondition: SidebarItemFieldPatch = {}

  for (const key of UNDOABLE_UPDATE_FIELD_KEYS) {
    if (valuesMatch(before[key], after[key])) continue
    setPatchField(fields, key, after[key])
    setPatchField(precondition, key, before[key])
  }

  if (Object.keys(fields).length === 0) return null
  return {
    type: 'updateSidebarItem' as const,
    itemId: before._id,
    before: precondition,
    fields,
  }
}

function insertedItemForwardPatch(after: Doc<'sidebarItems'>): FileSystemPatch {
  const hidden = undoHiddenSidebarItemFields()
  const afterFields = lifecyclePatchFields(after)
  return {
    type: 'updateSidebarItem',
    itemId: after._id,
    before: hidden,
    fields: afterFields,
  }
}

function insertedItemInversePatch(after: Doc<'sidebarItems'>): FileSystemPatch {
  return {
    type: 'updateSidebarItem',
    itemId: after._id,
    before: insertedItemUndoPrecondition(after),
    fields: undoHiddenSidebarItemFields(),
  }
}

function insertedItemUndoPrecondition(after: Doc<'sidebarItems'>): SidebarItemPatchPrecondition {
  return {
    type: after.type,
    name: assertSidebarItemName(after.name),
    slug: assertSidebarItemSlug(after.slug),
    iconName: after.iconName === null ? null : assertSidebarItemIconName(after.iconName),
    color: after.color === null ? null : assertSidebarItemColor(after.color),
    parentId: after.parentId,
    status: after.status,
    deletionTime: after.deletionTime,
    deletedBy: after.deletedBy,
    createdBy: after.createdBy,
  }
}

export function receiptPatchesFromChangeSet(changes: Array<FileSystemChange>) {
  const patches: Array<FileSystemPatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertSidebarItem':
        patches.push({ type: 'upsertSidebarItem', item: change.after })
        break
      case 'updateSidebarItem': {
        const patch = changedItemPatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
      case 'removeSidebarItem':
        patches.push({
          type: 'removeSidebarItem',
          itemId: change.itemId,
          snapshot: change.before,
        })
        break
    }
  }
  return patches
}

export function redoPatchesFromChangeSet(changes: Array<FileSystemChange>) {
  const patches: Array<FileSystemPatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertSidebarItem':
        patches.push(insertedItemForwardPatch(change.after))
        break
      case 'updateSidebarItem': {
        const patch = changedUndoableItemPatch(change.before, change.after)
        if (patch) patches.push(patch)
        break
      }
    }
  }
  return patches
}

export function undoPatchesFromChangeSet(changes: Array<FileSystemChange>) {
  const patches: Array<FileSystemPatch> = []
  for (const change of changes) {
    switch (change.type) {
      case 'insertSidebarItem':
        patches.push(insertedItemInversePatch(change.after))
        break
      case 'updateSidebarItem': {
        const patch = changedUndoableItemPatch(change.after, change.before)
        if (patch) patches.push(patch)
        break
      }
    }
  }
  return patches
}

function changeSetIsUndoable(changes: Array<FileSystemChange>) {
  return changes.length > 0 && changes.every((change) => change.type !== 'removeSidebarItem')
}

export type FileSystemWriteSession = {
  insertSidebarItem: (
    args: InsertFilesystemSidebarItemArgs,
  ) => Promise<{ itemId: Id<'sidebarItems'>; slug: string }>
  updateSidebarItem: (itemId: Id<'sidebarItems'>, fields: SidebarItemFieldPatch) => Promise<void>
  trashSidebarTree: (item: AnySidebarItemRow) => Promise<void>
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
): Promise<Array<Doc<'sidebarItems'>>> {
  const root = await ctx.db.get('sidebarItems', item._id)
  if (!root) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }
  const items: Array<Doc<'sidebarItems'>> = [root]
  if (root.type !== SIDEBAR_ITEM_TYPES.folders) return items

  const descendants = await collectDescendants(ctx, {
    campaignId: root.campaignId,
    status: root.status,
    folderId: root._id,
  })
  items.push(...(descendants as Array<Doc<'sidebarItems'>>))
  return items
}

export function createFileSystemWriteSession(ctx: CampaignMutationCtx): FileSystemWriteSession {
  const changes: Array<FileSystemChange> = []

  const recordChangedItem = (
    itemId: Id<'sidebarItems'>,
    before: Doc<'sidebarItems'>,
    after: Doc<'sidebarItems'> | null,
  ) => {
    if (snapshotsMatch(before, after)) return
    if (after) {
      changes.push({ type: 'updateSidebarItem', itemId, before, after })
      return
    }
    changes.push({ type: 'removeSidebarItem', itemId, before })
  }

  const recordTreeUpdatePatches = (
    beforeItems: Array<Doc<'sidebarItems'>>,
    getAfter: (before: Doc<'sidebarItems'>) => Doc<'sidebarItems'> | null,
  ) => {
    for (const before of beforeItems) {
      recordChangedItem(before._id, before, getAfter(before))
    }
  }

  const updateSidebarItem: FileSystemWriteSession['updateSidebarItem'] = async (itemId, fields) => {
    const before = await ctx.db.get('sidebarItems', itemId)
    if (!before) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    const after: Doc<'sidebarItems'> = { ...before, ...fields }
    const beforeSnapshot = before
    if (snapshotsMatch(beforeSnapshot, after)) return
    await ctx.db.patch('sidebarItems', itemId, fields)
    changes.push({ type: 'updateSidebarItem', itemId, before: beforeSnapshot, after })
  }

  const insertSidebarItem: FileSystemWriteSession['insertSidebarItem'] = async (args) => {
    const inserted = await insertFilesystemSidebarItem(ctx, args)
    const itemId = inserted.itemId
    const item = await ctx.db.get('sidebarItems', itemId)
    if (!item) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Inserted item not found')
    }
    changes.push({ type: 'insertSidebarItem', itemId, after: item })
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
    recordTreeUpdatePatches(beforeItems, (before) => {
      const patch: TrashTreePatch = {
        status: SIDEBAR_ITEM_STATUS.trashed,
        deletionTime: deletion.deletionTime,
        deletedBy: deletion.deletedBy,
        parentId: before._id === item._id ? null : before.parentId,
      }
      return {
        ...before,
        ...patch,
      }
    })
  }

  const restoreSidebarTree: FileSystemWriteSession['restoreSidebarTree'] = async (
    item,
    rootFields,
  ) => {
    const beforeItems = await collectTreeSnapshot(ctx, item)
    await ctx.db.patch('sidebarItems', item._id, rootFields)
    const rootBefore = beforeItems[0]
    if (!rootBefore) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
    }
    const afterById = new Map<Id<'sidebarItems'>, Doc<'sidebarItems'>>([
      [item._id, { ...rootBefore, ...rootFields }],
    ])
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      const restoredDescendants = await restoreTreeDescendants(ctx, item)
      for (const descendant of restoredDescendants) {
        afterById.set(descendant._id, descendant as Doc<'sidebarItems'>)
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
