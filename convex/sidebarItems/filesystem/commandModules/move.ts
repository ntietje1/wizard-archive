import { ERROR_CODE, throwClientError } from '../../../errors'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_STATUS,
  SIDEBAR_ITEM_TYPES,
} from '../../types/baseTypes'
import {
  ensureSidebarItemNameAvailable,
  findUniqueSidebarItemSlug,
  validateSidebarMove,
  validateNoCircularSidebarParentChange,
} from '../../validation/orchestration'
import { logEditHistory } from '../../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../editHistory/types'
import { resyncNoteLinksForNotes } from '../../../links/functions/resyncNoteLinksForNotes'
import { getActiveSidebarItemRowsByParent } from '../../functions/getSidebarItemsByParent'
import { planTransferOperations } from '../transferPlanner'
import { collectSidebarChildrenMap } from '../children'
import { normalizeSelectedRoots } from '../selection'
import { addSidebarItemAncestorsToMap } from '../ancestors'
import { collectDescendants } from '../../functions/collectDescendants'
import { assertSidebarOperationAllowed, evaluateRestore } from '../capabilities'
import { normalizeRestoreTargetParentId } from '../targets'
import { toDecisionRecord } from '../conflicts'
import { getSidebarItemStatus, isTrashedSidebarItem } from '../../types/status'
import { createFileSystemWriteSession } from '../deltas'
import { FILE_SYSTEM_EVENT_TYPE } from '../receipts'
import { createFileSystemReadModel } from '../readModel'
import { getSidebarItemRow } from '../sidebarItemRows'
import { checkSidebarItemRowAccess, requireSidebarItemRowAccess } from '../access'
import type { AccessibleSidebarItemRow } from '../access'
import type { OperationDecision } from '../conflicts'
import type { SidebarItemStatus } from '../../types/baseTypes'
import type { AnySidebarItemRow } from '../../types/types'
import type { CampaignMutationCtx } from '../../../functions'
import type { Id } from '../../../_generated/dataModel'
import { assertSidebarItemName } from '../../validation/name'
import type { TransferOperation } from '../operationTypes'
import type { FileSystemWriteSession } from '../deltas'
import type {
  FileSystemOperationDecision,
  MoveFileSystemCommand,
  RestoreFileSystemCommand,
  TrashFileSystemCommand,
} from '../commands'
import type { FileSystemDelta, FileSystemEvent } from '../receipts'

const clearDeletion = { deletionTime: null, deletedBy: null }

type MoveMergeFolderOperation = Extract<TransferOperation, { action: 'mergeFolder' }>
type ExecutableMoveOperation = TransferOperation
type MoveCommandAction = 'move' | 'restore' | 'trash'
type MoveCommandResult = {
  events: Array<FileSystemEvent>
}
type MoveSelfEventType =
  | typeof FILE_SYSTEM_EVENT_TYPE.moved
  | typeof FILE_SYSTEM_EVENT_TYPE.trashed
  | typeof FILE_SYSTEM_EVENT_TYPE.restored
  | typeof FILE_SYSTEM_EVENT_TYPE.skipped
  | typeof FILE_SYSTEM_EVENT_TYPE.replaced
  | typeof FILE_SYSTEM_EVENT_TYPE.mergedFolder
  | typeof FILE_SYSTEM_EVENT_TYPE.noop

const MOVE_OPERATION_ACTION = {
  place: 'place',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

const MAX_SIDEBAR_MOVE_DEPTH = 50

function createEmptyMoveResult(): MoveCommandResult {
  return {
    events: [],
  }
}

function pushSelfEvent(
  result: MoveCommandResult,
  type: MoveSelfEventType,
  itemId: Id<'sidebarItems'>,
) {
  if (
    type === FILE_SYSTEM_EVENT_TYPE.skipped ||
    type === FILE_SYSTEM_EVENT_TYPE.replaced ||
    type === FILE_SYSTEM_EVENT_TYPE.mergedFolder
  ) {
    result.events.push({ type, itemId, sourceItemId: itemId })
    return
  }
  result.events.push({ type, itemId })
}

function applySkippedDecisions(
  result: MoveCommandResult,
  decisions: Array<OperationDecision> | undefined,
) {
  const skipped = new Set(
    result.events
      .filter((event) => event.type === FILE_SYSTEM_EVENT_TYPE.skipped)
      .map((event) => event.itemId),
  )
  for (const decision of decisions ?? []) {
    if (decision.action !== 'skip' || skipped.has(decision.sourceItemId)) continue
    pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.skipped, decision.sourceItemId)
    skipped.add(decision.sourceItemId)
  }
}

async function resyncRelativeLinksForMovedItems(
  ctx: CampaignMutationCtx,
  {
    item,
    status,
  }: {
    item: AnySidebarItemRow
    status: SidebarItemStatus
  },
): Promise<void> {
  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    await resyncNoteLinksForNotes(ctx, { noteIds: [item._id] })
    return
  }

  if (item.type !== SIDEBAR_ITEM_TYPES.folders) {
    return
  }

  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    status,
    folderId: item._id,
  })
  const descendantNoteIds = descendants
    .filter((descendant) => descendant.type === SIDEBAR_ITEM_TYPES.notes)
    .map((descendant) => descendant._id)

  await resyncNoteLinksForNotes(ctx, { noteIds: descendantNoteIds })
}

async function loadMovableSource(ctx: CampaignMutationCtx, itemId: Id<'sidebarItems'>) {
  const itemFromDb = await getSidebarItemRow(ctx, itemId)
  return await requireSidebarItemRowAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
}

async function resolveRestoreTargetParentId(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null | undefined,
): Promise<{ parentId: Id<'sidebarItems'> | null; parent: AnySidebarItemRow | null }> {
  if (!parentId) return { parentId: null, parent: null }

  const parent = await getSidebarItemRow(ctx, parentId)
  if (!parent) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
  }

  const normalizedParentId = normalizeRestoreTargetParentId(parentId, parent)
  return {
    parentId: normalizedParentId,
    parent: normalizedParentId === null ? null : parent,
  }
}

async function executeRestore(
  ctx: CampaignMutationCtx,
  {
    item,
    parentId,
    name,
    session,
  }: {
    item: AccessibleSidebarItemRow
    parentId?: Id<'sidebarItems'> | null
    name?: string
    session: FileSystemWriteSession
  },
) {
  const restoreTarget = await resolveRestoreTargetParentId(ctx, parentId)
  const restoreParentId = restoreTarget.parentId
  const requestedName = name ? assertSidebarItemName(name) : null
  const restoreParent =
    restoreParentId === null
      ? null
      : await checkSidebarItemRowAccess(ctx, {
          rawItem: restoreTarget.parent,
          requiredLevel: PERMISSION_LEVEL.NONE,
        })
  assertSidebarOperationAllowed(
    evaluateRestore({ role: ctx.membership.role }, item, {
      parentId: restoreParentId,
      parent: restoreParent,
    }),
  )

  await validateNoCircularSidebarParentChange(ctx, {
    item,
    newParentId: restoreParentId,
  })

  if (requestedName) {
    await ensureSidebarItemNameAvailable(ctx, {
      parentId: restoreParentId,
      name: requestedName,
      excludeId: item._id,
    })
  }
  const conflictPatch = requestedName
    ? {
        name: requestedName,
        slug: await findUniqueSidebarItemSlug(ctx, {
          itemId: item._id,
          name: requestedName,
        }),
      }
    : {}

  await session.restoreSidebarTree(item, {
    ...clearDeletion,
    ...conflictPatch,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.active,
    parentId: restoreParentId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.restored,
  })

  await resyncRelativeLinksForMovedItems(ctx, {
    item,
    status: SIDEBAR_ITEM_STATUS.active,
  })
}

async function executeParentMove(
  ctx: CampaignMutationCtx,
  {
    item,
    parentId,
    name,
    session,
  }: {
    item: AccessibleSidebarItemRow
    parentId: Id<'sidebarItems'> | null
    name?: string
    session: FileSystemWriteSession
  },
) {
  const requestedName = name ? assertSidebarItemName(name) : null
  await validateSidebarMove(ctx, {
    item,
    newParentId: parentId,
    name: requestedName ?? undefined,
  })

  const oldParent = item.parentId ? await getSidebarItemRow(ctx, item.parentId) : null
  const newParent = parentId ? await getSidebarItemRow(ctx, parentId) : null
  const renamePatch =
    requestedName && requestedName !== item.name
      ? {
          name: requestedName,
          slug: await findUniqueSidebarItemSlug(ctx, {
            itemId: item._id,
            name: requestedName,
          }),
        }
      : {}

  await session.updateSidebarItem(item._id, {
    parentId,
    ...renamePatch,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.moved,
    metadata: {
      from: oldParent?.name ?? null,
      to: newParent?.name ?? null,
    },
  })

  await resyncRelativeLinksForMovedItems(ctx, {
    item,
    status: getSidebarItemStatus(item),
  })
}

async function collectMoveChildrenMap(
  ctx: CampaignMutationCtx,
  folders: Array<Pick<AccessibleSidebarItemRow, '_id' | 'status'>>,
) {
  const folderStatuses = new Map(folders.map((folder) => [folder._id, folder.status]))

  return await collectSidebarChildrenMap({
    rootFolderIds: folders.map((folder) => folder._id),
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
    getChildren: async (parentId) => {
      const status = folderStatuses.get(parentId)
      if (!status) {
        throw new Error(
          `Missing sidebar item status for folder ${parentId} while collecting move children`,
        )
      }
      const children = await getSidebarItemRowsByParentStatus(ctx, {
        parentId,
        status,
      })
      for (const child of children) {
        if (child.type === SIDEBAR_ITEM_TYPES.folders) {
          folderStatuses.set(child._id, child.status)
        }
      }
      return children
    },
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar move planning depth exceeded')
    },
  })
}

async function getSidebarItemRowsByParentStatus(
  ctx: CampaignMutationCtx,
  {
    parentId,
    status,
  }: {
    parentId: Id<'sidebarItems'>
    status: SidebarItemStatus
  },
): Promise<Array<AnySidebarItemRow>> {
  const children = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('status', status).eq('parentId', parentId),
    )
    .collect()
  return children
}

async function executeMoveOperations(
  ctx: CampaignMutationCtx,
  operations: Array<TransferOperation>,
  action: MoveCommandAction,
  rootSourceIds: Array<Id<'sidebarItems'>>,
  session: FileSystemWriteSession,
): Promise<MoveCommandResult> {
  const result = createEmptyMoveResult()
  const operationSourceIds = new Set<Id<'sidebarItems'>>()

  for (const operation of operations) {
    operationSourceIds.add(operation.sourceItemId)
    const affectedId = await executeMoveOperation(ctx, operation, session)
    if (!affectedId) continue

    if (operation.action === MOVE_OPERATION_ACTION.replace) {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.replaced, operation.sourceItemId)
      continue
    } else if (operation.action === MOVE_OPERATION_ACTION.mergeFolder) {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.mergedFolder, affectedId)
    } else if (action === 'restore') {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.restored, affectedId)
    } else {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.moved, affectedId)
    }
  }

  for (const sourceItemId of rootSourceIds) {
    if (!operationSourceIds.has(sourceItemId)) {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.noop, sourceItemId)
    }
  }
  return result
}

async function executeMoveOperation(
  ctx: CampaignMutationCtx,
  operation: ExecutableMoveOperation,
  session: FileSystemWriteSession,
): Promise<Id<'sidebarItems'> | null> {
  const source = await loadMovableSource(ctx, operation.sourceItemId)

  if (operation.action === MOVE_OPERATION_ACTION.mergeFolder) {
    // Merge events are keyed to the incoming root because UI feedback counts selected source roots.
    await executeMergeFolderMove(ctx, source, operation, session)
    return source._id
  }

  if (operation.action === MOVE_OPERATION_ACTION.replace) {
    await trashMoveReplacement(ctx, operation.destinationItemId, session)
  }

  if (isTrashedSidebarItem(source)) {
    await executeRestore(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
      session,
    })
  } else {
    await executeParentMove(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
      session,
    })
  }
  return source._id
}

async function executeMergeFolderMove(
  ctx: CampaignMutationCtx,
  source: AccessibleSidebarItemRow,
  operation: MoveMergeFolderOperation,
  session: FileSystemWriteSession,
): Promise<Id<'sidebarItems'>> {
  if (source.type !== SIDEBAR_ITEM_TYPES.folders || !operation.destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only folders can be merged')
  }

  const rawDestination = await getSidebarItemRow(ctx, operation.destinationItemId)
  const destination = await requireSidebarItemRowAccess(ctx, {
    rawItem: rawDestination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (destination.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Destination folder not found')
  }

  // Merge-folder plans move children before this operation; the source can be trashed only once empty.
  const remainingChildren = await getActiveSidebarItemRowsByParent(ctx, { parentId: source._id })
  if (remainingChildren.length === 0) {
    await session.trashSidebarTree(source)
  }
  return destination._id
}

async function trashMoveReplacement(
  ctx: CampaignMutationCtx,
  destinationItemId: Id<'sidebarItems'> | undefined,
  session: FileSystemWriteSession,
) {
  if (!destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Replace requires a destination item')
  }

  const rawDestination = await getSidebarItemRow(ctx, destinationItemId)
  const destination = await requireSidebarItemRowAccess(ctx, {
    rawItem: rawDestination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (destination.type === SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
  }

  await session.trashSidebarTree(destination)
}

async function loadMovableSources(
  ctx: CampaignMutationCtx,
  sourceItemIds: Array<Id<'sidebarItems'>>,
) {
  return await Promise.all(
    sourceItemIds.map((sourceItemId) => loadMovableSource(ctx, sourceItemId)),
  )
}

async function normalizeOperationRoots(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AccessibleSidebarItemRow>,
) {
  const folders = sourceItems.filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
  const childrenMap = await collectMoveChildrenMap(ctx, folders)
  const itemsById = buildOperationReadModel(sourceItems, childrenMap).itemsById
  await addSidebarItemAncestorsToMap(ctx, {
    items: sourceItems,
    itemsById,
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
  })
  return normalizeSelectedRoots(sourceItems, itemsById)
}

function buildOperationReadModel(
  items: Array<Pick<AnySidebarItemRow, '_id' | 'parentId' | 'status'>>,
  childrenMap: Map<Id<'sidebarItems'>, Array<AnySidebarItemRow>>,
) {
  const rowsById = new Map<
    Id<'sidebarItems'>,
    Pick<AnySidebarItemRow, '_id' | 'parentId' | 'status'>
  >()
  for (const item of items) {
    rowsById.set(item._id, { _id: item._id, parentId: item.parentId, status: item.status })
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      if (rowsById.has(child._id)) continue
      rowsById.set(child._id, { _id: child._id, parentId: child.parentId, status: child.status })
    }
  }
  return createFileSystemReadModel(Array.from(rowsById.values()))
}

async function trashSidebarItems(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AccessibleSidebarItemRow>,
  session: FileSystemWriteSession,
): Promise<MoveCommandResult> {
  const rootItems = await normalizeOperationRoots(ctx, sourceItems)
  const result = createEmptyMoveResult()

  for (const item of rootItems) {
    if (isTrashedSidebarItem(item)) {
      pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.noop, item._id)
      continue
    }
    await session.trashSidebarTree(item)
    pushSelfEvent(result, FILE_SYSTEM_EVENT_TYPE.trashed, item._id)
  }

  return result
}

function assertRestoreActionSources(sourceItems: Array<AccessibleSidebarItemRow>) {
  const invalidItem = sourceItems.find((item) => !isTrashedSidebarItem(item))
  if (!invalidItem) return

  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only trashed items can be restored')
}

async function executeMovePlan(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    action = 'move',
    decisions,
    session,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    action?: MoveCommandAction
    decisions?: Array<OperationDecision>
    session: FileSystemWriteSession
  },
): Promise<MoveCommandResult> {
  const sourceItems = await loadMovableSources(ctx, sourceItemIds)

  if (action === 'trash') {
    return await trashSidebarItems(ctx, sourceItems, session)
  }

  if (action === 'restore') {
    assertRestoreActionSources(sourceItems)
  }

  const effectiveTargetParentId =
    action === 'restore'
      ? (await resolveRestoreTargetParentId(ctx, targetParentId)).parentId
      : targetParentId
  const targetItems = await getActiveSidebarItemRowsByParent(ctx, {
    parentId: effectiveTargetParentId,
  })
  const folders = [...sourceItems, ...targetItems].filter(
    (item) => item.type === SIDEBAR_ITEM_TYPES.folders,
  )
  const childrenMap = await collectMoveChildrenMap(ctx, folders)
  const readModel = buildOperationReadModel([...sourceItems, ...targetItems], childrenMap)
  await addSidebarItemAncestorsToMap(ctx, {
    items: sourceItems,
    itemsById: readModel.itemsById,
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
  })
  const plan = planTransferOperations({
    mode: 'move',
    items: sourceItems,
    itemsById: readModel.itemsById,
    targetParentId: effectiveTargetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })

  if (plan.status === 'needs-decision') {
    const conflictSummary = plan.conflicts
      .map((conflict) => `${conflict.sourceName} -> ${conflict.destinationName}`)
      .join(', ')
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Operation requires conflict decisions: ${conflictSummary}`,
    )
  }

  const rootSourceItems = normalizeSelectedRoots(sourceItems, readModel.itemsById)
  const result = await executeMoveOperations(
    ctx,
    plan.operations,
    action,
    rootSourceItems.map((item) => item._id),
    session,
  )
  applySkippedDecisions(result, decisions)
  return result
}

export async function executeMoveCommand(
  ctx: CampaignMutationCtx,
  {
    command,
    action,
    decisions,
  }: {
    command: MoveFileSystemCommand | RestoreFileSystemCommand | TrashFileSystemCommand
    action: MoveCommandAction
    decisions?: Array<FileSystemOperationDecision>
  },
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const result = await executeMovePlan(ctx, {
    sourceItemIds: command.itemIds,
    targetParentId: command.type === 'trash' ? null : command.targetParentId,
    action,
    decisions,
    session,
  })

  return await session.build({
    command,
    events: result.events,
  })
}
