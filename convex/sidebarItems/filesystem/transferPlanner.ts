import { isTrashedSidebarItem } from '../types/status'
import { deduplicateName } from '../functions/defaultItemName'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflicts'
import { ERROR_CODE, throwClientError } from '../../errors'
import { normalizeSelectedRoots } from './selection'
import type { ConflictDecision, ItemOperationConflict, PlannerItemStatus } from './conflicts'
import type { OperationPlannerItem } from './selection'
import type { Id } from '../../_generated/dataModel'

const MAX_OPERATION_DEPTH = 50
const MAX_ERROR_ITEMS = 10

export type TransferMode = 'copy' | 'move'
export type TransferOperation =
  | {
      sourceItemId: Id<'sidebarItems'>
      action: 'place'
      targetParentId: Id<'sidebarItems'> | null
      name?: string
    }
  | {
      sourceItemId: Id<'sidebarItems'>
      action: 'replace'
      targetParentId: Id<'sidebarItems'> | null
      destinationItemId: Id<'sidebarItems'>
      name: string
    }
  | {
      sourceItemId: Id<'sidebarItems'>
      action: 'mergeFolder'
      targetParentId: Id<'sidebarItems'> | null
      destinationItemId: Id<'sidebarItems'>
    }
export type TransferOperationPlan =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<TransferOperation>
      skippedSourceItemIds?: Array<Id<'sidebarItems'>>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }

type TransferPlannerContext = {
  mode: TransferMode
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
  depth: number
  movingIds: Set<Id<'sidebarItems'>>
  conflicts: Array<ItemOperationConflict>
  operations: Array<TransferOperation>
  reservedNames: Array<string>
  usedDecisionSourceIds: Set<Id<'sidebarItems'>>
  skippedSourceItemIds: Set<Id<'sidebarItems'>>
}

function formatItemIdsForError(items: Array<OperationPlannerItem>): string {
  const visibleIds = items.slice(0, MAX_ERROR_ITEMS).map((item) => item._id)
  const suffix =
    items.length > MAX_ERROR_ITEMS ? ` ... (+${items.length - MAX_ERROR_ITEMS} more)` : ''
  return `${visibleIds.join(', ')}${suffix}`
}

function addPlaceOperation(context: TransferPlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item._id,
    action: 'place',
    targetParentId: context.targetParentId,
    ...(context.mode === 'copy' || name !== item.name ? { name } : {}),
  })
  context.reservedNames.push(name)
}

function addReplaceOperation(
  context: TransferPlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
) {
  context.operations.push({
    sourceItemId: item._id,
    action: 'replace',
    targetParentId: context.targetParentId,
    destinationItemId: conflictTarget._id,
    name: item.name,
  })
  context.reservedNames.push(item.name)
}

function addFolderMergeOperations(
  context: TransferPlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): PlannerItemStatus {
  return addPlannedFolderMergeOperations({
    context,
    item,
    conflictTarget,
    planChildren: planTransferOperations,
    createMergeOperation: ({
      sourceItemId,
      targetParentId,
      destinationItemId,
    }): TransferOperation => ({
      sourceItemId,
      action: 'mergeFolder',
      targetParentId,
      destinationItemId,
    }),
  })
}

function targetConflictCandidates(context: TransferPlannerContext) {
  if (context.mode === 'copy') return context.targetItems
  return context.targetItems.filter((targetItem) => !context.movingIds.has(targetItem._id))
}

function isSameParentMoveNoop(context: TransferPlannerContext, item: OperationPlannerItem) {
  return (
    context.mode === 'move' &&
    item.parentId === context.targetParentId &&
    !isTrashedSidebarItem(item)
  )
}

function planTransferItem(
  context: TransferPlannerContext,
  item: OperationPlannerItem,
): PlannerItemStatus {
  const conflictTarget = findNameConflict(item, targetConflictCandidates(context))
  if (!conflictTarget) {
    if (isSameParentMoveNoop(context, item)) {
      context.reservedNames.push(item.name)
      return 'ready'
    }
    addPlaceOperation(context, item)
    return 'ready'
  }

  if (conflictTarget._id === item._id) {
    addPlaceOperation(context, item)
    return 'ready'
  }

  return applyConflictDecision(context, item, conflictTarget, {
    keepBoth: () => addPlaceOperation(context, item),
    replace: () => addReplaceOperation(context, item, conflictTarget),
    mergeFolders: () => addFolderMergeOperations(context, item, conflictTarget),
  })
}

function assertDecisionsMatchConflicts({
  decisions,
  usedDecisionSourceIds,
}: {
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  usedDecisionSourceIds: ReadonlySet<Id<'sidebarItems'>>
}) {
  for (const sourceItemId of Object.keys(decisions) as Array<Id<'sidebarItems'>>) {
    if (usedDecisionSourceIds.has(sourceItemId)) continue
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Conflict decision does not match an item with a conflict',
    )
  }
}

export function planTransferOperations({
  mode,
  items,
  targetParentId,
  targetItems,
  decisions = {},
  defaultConflictDecision,
  usedDecisionSourceIds = new Set<Id<'sidebarItems'>>(),
  skippedSourceItemIds = new Set<Id<'sidebarItems'>>(),
  getChildren,
  itemsById,
  depth = 0,
}: {
  mode: TransferMode
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  usedDecisionSourceIds?: Set<Id<'sidebarItems'>>
  skippedSourceItemIds?: Set<Id<'sidebarItems'>>
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth?: number
}): TransferOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(
      `Max sidebar ${mode} planning depth exceeded at depth ${depth} for target ${targetParentId ?? 'root'} with items ${formatItemIdsForError(items)}`,
    )
  }
  const roots = normalizeSelectedRoots(items, itemsById)
  const movingIds = new Set(roots.map((item) => item._id))
  const context: TransferPlannerContext = {
    mode,
    targetParentId,
    targetItems,
    decisions,
    defaultConflictDecision,
    getChildren,
    itemsById,
    depth,
    movingIds,
    conflicts: [],
    operations: [],
    usedDecisionSourceIds,
    skippedSourceItemIds,
    reservedNames:
      mode === 'copy'
        ? Array.from(new Set(targetItems.map((item) => item.name)))
        : Array.from(
            new Set(
              targetItems.filter((item) => !movingIds.has(item._id)).map((item) => item.name),
            ),
          ),
  }

  for (const item of roots) {
    planTransferItem(context, item)
  }

  if (depth === 0) {
    assertDecisionsMatchConflicts({ decisions, usedDecisionSourceIds })
  }

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  const skippedIds = Array.from(context.skippedSourceItemIds)
  return {
    status: 'ready',
    conflicts: [],
    operations: context.operations,
    ...(skippedIds.length > 0 ? { skippedSourceItemIds: skippedIds } : {}),
  }
}
