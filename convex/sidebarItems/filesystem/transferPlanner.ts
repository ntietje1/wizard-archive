import { isTrashedSidebarItem } from '../types/status'
import { deduplicateName } from '../functions/defaultItemName'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflicts'
import { normalizeSelectedRoots } from './selection'
import type { PlannerItemStatus } from './conflicts'
import type { OperationPlannerItem } from './selection'
import type { Id } from '../../_generated/dataModel'
import type {
  ConflictDecision,
  ItemOperationConflict,
  TransferOperation,
  TransferOperationPlan,
} from './operationTypes'

const MAX_OPERATION_DEPTH = 50
const MAX_ERROR_ITEMS = 10

export type TransferMode = 'copy' | 'move'

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

export function planTransferOperations({
  mode,
  items,
  targetParentId,
  targetItems,
  decisions = {},
  defaultConflictDecision,
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

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations: context.operations }
}
