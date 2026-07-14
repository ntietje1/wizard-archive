import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { PERMISSION_OPERATION } from '../../../../shared/permissions/requirements'
import {
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import type { ResourceStatus } from '@wizard-archive/editor/resources/resource-contract'

import {
  findUniqueSidebarItemSlug,
  validateSidebarMove,
  validateNoCircularSidebarParentChange,
} from '../../validation/orchestration'
import { logEditHistory } from '../../../editHistory/log'
import { resyncNoteLinksForNotes } from '../../../links/functions/resyncNoteLinksForNotes'
import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import { evaluateRestore } from '@wizard-archive/editor/resources/operation-capabilities'
import { planTransferOperations } from '@wizard-archive/editor/resources/operation-contract'
import { normalizeSelectedRoots } from '@wizard-archive/editor/resources/selection-roots'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import type {
  ResourceCommand,
  ResourceEvent,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { TransferOperation } from '@wizard-archive/editor/resources/operation-contract'
import { loadSidebarItemAncestorMap } from '../ancestors'
import { collectDescendants } from '../../functions/collectDescendants'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../capabilities'
import { isActiveSidebarItem, isTrashedSidebarItem } from '../../types/status'
import { createFileSystemWriteSession } from '../deltas'
import { createSidebarOperationReadModel, toSidebarOperationItems } from '../readModel'
import { getSidebarItemRow } from '../sidebarItemRows'
import { checkSidebarItemRowAccess, requireSidebarItemRowOperationAccess } from '../access'
import type { AccessibleSidebarItemRow } from '../access'
import type { CampaignMutationCtx } from '../../../functions'
import type { Doc, Id } from '../../../_generated/dataModel'
import { assertConvexResourceTitle } from '../../validation/name'
import type { FileSystemWriteSession, StoredResourceDelta } from '../deltas'
const clearDeletion = { deletionTime: null, deletedBy: null }
type StoredSidebarItemRow = Doc<'sidebarItems'>

type MoveCommandAction = 'move' | 'restore' | 'trash'
type MoveSelfEventType =
  | typeof RESOURCE_EVENT_TYPE.moved
  | typeof RESOURCE_EVENT_TYPE.trashed
  | typeof RESOURCE_EVENT_TYPE.restored
  | typeof RESOURCE_EVENT_TYPE.noop

type MoveFileSystemCommand = Extract<ResourceCommand, { type: 'move' }>
type RestoreFileSystemCommand = Extract<ResourceCommand, { type: 'restore' }>
type TrashFileSystemCommand = Extract<ResourceCommand, { type: 'trash' }>

const MAX_SIDEBAR_MOVE_DEPTH = 50

function pushSelfEvent(
  events: Array<ResourceEvent>,
  type: MoveSelfEventType,
  itemId: Id<'sidebarItems'>,
) {
  events.push({ type, itemId })
}

async function resyncRelativeLinksForMovedItems(
  ctx: CampaignMutationCtx,
  {
    item,
    status,
  }: {
    item: StoredSidebarItemRow
    status: ResourceStatus
  },
): Promise<void> {
  if (item.type === RESOURCE_TYPES.notes) {
    await resyncNoteLinksForNotes(ctx, { noteIds: [item._id] })
    return
  }

  if (item.type !== RESOURCE_TYPES.folders) {
    return
  }

  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    status,
    folderId: item._id,
  })
  const descendantNoteIds = descendants
    .filter((descendant) => descendant.type === RESOURCE_TYPES.notes)
    .map((descendant) => descendant._id)

  await resyncNoteLinksForNotes(ctx, { noteIds: descendantNoteIds })
}

async function loadMovableSource(ctx: CampaignMutationCtx, itemId: Id<'sidebarItems'>) {
  const itemRow = await getSidebarItemRow(ctx, itemId)
  return await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: itemRow,
    operation: PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM,
  })
}

async function resolveRestoreTargetParentId(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null | undefined,
): Promise<{ parentId: Id<'sidebarItems'> | null; parent: StoredSidebarItemRow | null }> {
  if (!parentId) return { parentId: null, parent: null }

  const parent = await getSidebarItemRow(ctx, parentId)
  if (!parent) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
  }

  const normalizedParentId = isTrashedSidebarItem(parent) ? null : parentId
  return {
    parentId: normalizedParentId,
    parent: normalizedParentId === null ? null : parent,
  }
}

async function collectRestoreTargetAncestorIds(
  ctx: CampaignMutationCtx,
  parent: StoredSidebarItemRow | null,
): Promise<Array<Id<'sidebarItems'>>> {
  const ancestorIds: Array<Id<'sidebarItems'>> = []
  const visitedParentIds = new Set<Id<'sidebarItems'>>()
  let currentParentId = parent?._id ?? null

  while (currentParentId) {
    if (visitedParentIds.has(currentParentId)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Existing sidebar parent cycle detected')
    }
    if (ancestorIds.length >= MAX_SIDEBAR_MOVE_DEPTH) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar restore target depth exceeded')
    }
    visitedParentIds.add(currentParentId)
    const currentParent = await getSidebarItemRow(ctx, currentParentId)
    if (!currentParent) {
      throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
    }
    ancestorIds.push(currentParent._id)
    currentParentId = currentParent.parentId
  }

  return ancestorIds
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
  const requestedName = name ? assertConvexResourceTitle(name) : null
  const restoreParent =
    restoreParentId === null
      ? null
      : await checkSidebarItemRowAccess(ctx, {
          rawItem: restoreTarget.parent,
          requiredLevel: PERMISSION_LEVEL.NONE,
        })
  const restoreTargetAncestorIds = await collectRestoreTargetAncestorIds(ctx, restoreTarget.parent)
  assertSidebarOperationAllowed(
    evaluateRestore(operationActorFromRole(ctx.membership.role), item, {
      parentId: restoreParentId,
      parent: restoreParent,
      ancestorIds: restoreTargetAncestorIds,
    }),
  )

  await validateNoCircularSidebarParentChange(ctx, {
    item,
    newParentId: restoreParentId,
  })

  const titlePatch = requestedName
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
    ...titlePatch,
    status: RESOURCE_STATUS.active,
    parentId: restoreParentId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.restored,
  })

  await resyncRelativeLinksForMovedItems(ctx, {
    item,
    status: RESOURCE_STATUS.active,
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
  const requestedName = name ? assertConvexResourceTitle(name) : null
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

  await session.updateResource(item._id, {
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
    status: item.status,
  })
}

async function executeMoveOperations(
  ctx: CampaignMutationCtx,
  operations: Array<TransferOperation>,
  action: MoveCommandAction,
  rootSourceIds: Array<Id<'sidebarItems'>>,
  session: FileSystemWriteSession,
): Promise<Array<ResourceEvent>> {
  const events: Array<ResourceEvent> = []
  const operationSourceIds = new Set<Id<'sidebarItems'>>()

  for (const operation of operations) {
    operationSourceIds.add(operation.sourceItemId)
    const affectedId = await executeMoveOperation(ctx, operation, action, session)
    if (!affectedId) continue

    if (action === 'restore') {
      pushSelfEvent(events, RESOURCE_EVENT_TYPE.restored, affectedId)
    } else {
      pushSelfEvent(events, RESOURCE_EVENT_TYPE.moved, affectedId)
    }
  }

  for (const sourceItemId of rootSourceIds) {
    if (!operationSourceIds.has(sourceItemId)) {
      pushSelfEvent(events, RESOURCE_EVENT_TYPE.noop, sourceItemId)
    }
  }
  return events
}

async function executeMoveOperation(
  ctx: CampaignMutationCtx,
  operation: TransferOperation,
  action: MoveCommandAction,
  session: FileSystemWriteSession,
): Promise<Id<'sidebarItems'> | null> {
  const source = await loadMovableSource(ctx, operation.sourceItemId)

  if (action === 'restore') {
    if (!isTrashedSidebarItem(source)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only trashed items can be restored')
    }
    await executeRestore(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
      session,
    })
  } else {
    if (!isActiveSidebarItem(source)) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active items can be moved')
    }
    await executeParentMove(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
      session,
    })
  }
  return source._id
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
  const itemsById = createSidebarOperationReadModel({
    items: sourceItems,
    childrenMap: new Map(),
  }).itemsById
  const ancestorItemsById = await loadSidebarItemAncestorMap(ctx, {
    items: sourceItems,
    itemsById,
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
  })
  const rootIds = new Set(
    normalizeSelectedRoots(toSidebarOperationItems(sourceItems), ancestorItemsById).map(
      (item) => item.id,
    ),
  )
  return sourceItems.filter((item) => rootIds.has(item.id))
}

async function trashSidebarItems(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AccessibleSidebarItemRow>,
  session: FileSystemWriteSession,
): Promise<Array<ResourceEvent>> {
  const rootItems = await normalizeOperationRoots(ctx, sourceItems)
  const events: Array<ResourceEvent> = []

  for (const item of rootItems) {
    if (isTrashedSidebarItem(item)) {
      pushSelfEvent(events, RESOURCE_EVENT_TYPE.noop, item._id)
      continue
    }
    await session.trashSidebarTree(item)
    pushSelfEvent(events, RESOURCE_EVENT_TYPE.trashed, item._id)
  }

  return events
}

function assertRestoreActionSources(sourceItems: Array<AccessibleSidebarItemRow>) {
  const invalidItem = sourceItems.find((item) => !isTrashedSidebarItem(item))
  if (!invalidItem) return

  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only trashed items can be restored')
}

function assertMoveActionSources(sourceItems: Array<AccessibleSidebarItemRow>) {
  const invalidItem = sourceItems.find((item) => !isActiveSidebarItem(item))
  if (!invalidItem) return

  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active items can be moved')
}

function assertTrashActionSources(sourceItems: Array<AccessibleSidebarItemRow>) {
  const invalidItem = sourceItems.find(
    (item) => !isActiveSidebarItem(item) && !isTrashedSidebarItem(item),
  )
  if (!invalidItem) return

  throwClientError(
    ERROR_CODE.VALIDATION_FAILED,
    'Only active or trashed items can be used as sources for trash actions',
  )
}

async function executeMovePlan(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    action = 'move',
    session,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    action?: MoveCommandAction
    session: FileSystemWriteSession
  },
): Promise<Array<ResourceEvent>> {
  const sourceItems = await loadMovableSources(ctx, sourceItemIds)

  if (action === 'trash') {
    assertTrashActionSources(sourceItems)
    return await trashSidebarItems(ctx, sourceItems, session)
  }

  if (action === 'restore') {
    assertRestoreActionSources(sourceItems)
  } else {
    assertMoveActionSources(sourceItems)
  }

  const effectiveTargetParentId =
    action === 'restore'
      ? (await resolveRestoreTargetParentId(ctx, targetParentId)).parentId
      : targetParentId
  const readModel = createSidebarOperationReadModel({
    items: sourceItems,
    childrenMap: new Map(),
  })
  const ancestorItemsById = await loadSidebarItemAncestorMap(ctx, {
    items: sourceItems,
    itemsById: readModel.itemsById,
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
  })
  const operations = planTransferOperations({
    mode: 'move',
    items: toSidebarOperationItems(sourceItems),
    itemsById: ancestorItemsById,
    targetParentId: effectiveTargetParentId,
  })

  const rootSourceItems = normalizeSelectedRoots(
    toSidebarOperationItems(sourceItems),
    ancestorItemsById,
  )
  const events = await executeMoveOperations(
    ctx,
    operations,
    action,
    rootSourceItems.map((item) => item.id),
    session,
  )
  return events
}

export async function executeMoveCommand(
  ctx: CampaignMutationCtx,
  {
    command,
    action,
  }: {
    command: MoveFileSystemCommand | RestoreFileSystemCommand | TrashFileSystemCommand
    action: MoveCommandAction
  },
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const events = await executeMovePlan(ctx, {
    sourceItemIds: command.itemIds,
    targetParentId: command.type === 'trash' ? null : command.targetParentId,
    action,
    session,
  })

  return await session.build({
    command,
    events,
  })
}
