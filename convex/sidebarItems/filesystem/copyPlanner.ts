import { deduplicateName } from '../functions/defaultItemName'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflicts'
import type { PlannerItemStatus } from './conflicts'
import { normalizePlannerRootItemsStrict } from './selection'
import type { OperationPlannerItem } from './selection'
import type { Id } from '../../_generated/dataModel'
import type {
  ConflictDecision,
  CopyOperation,
  CopyOperationPlan,
  ItemOperationConflict,
} from './operationTypes'

const MAX_OPERATION_DEPTH = 50

type CopyPlannerContext = {
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth: number
  conflicts: Array<ItemOperationConflict>
  operations: Array<CopyOperation>
  reservedNames: Array<string>
}

function addCopyOperation(context: CopyPlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item._id,
    action: 'copy',
    targetParentId: context.targetParentId,
    name,
  })
  context.reservedNames.push(name)
}

function addReplaceOperation(
  context: CopyPlannerContext,
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
  context: CopyPlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): PlannerItemStatus {
  return addPlannedFolderMergeOperations({
    context,
    item,
    conflictTarget,
    planChildren: planCopyOperations,
    createMergeOperation: ({ sourceItemId, targetParentId, destinationItemId }): CopyOperation => ({
      sourceItemId,
      action: 'mergeFolder',
      targetParentId,
      destinationItemId,
    }),
  })
}

function planCopyItem(context: CopyPlannerContext, item: OperationPlannerItem): PlannerItemStatus {
  const conflictTarget = findNameConflict(item, context.targetItems)
  if (!conflictTarget) {
    addCopyOperation(context, item)
    return 'ready'
  }

  if (conflictTarget._id === item._id && item.parentId === context.targetParentId) {
    addCopyOperation(context, item)
    return 'ready'
  }

  return applyConflictDecision(context, item, conflictTarget, {
    keepBoth: () => addCopyOperation(context, item),
    replace: () => addReplaceOperation(context, item, conflictTarget),
    mergeFolders: () => addFolderMergeOperations(context, item, conflictTarget),
  })
}

/**
 * Builds a batch copy plan for sidebar items without mutating storage.
 *
 * @param items Selected OperationPlannerItem roots to copy.
 * @param targetParentId Destination parent for copied items.
 * @param targetItems Existing siblings in the destination parent.
 * @param decisions Optional conflict decisions keyed by source item id.
 * @param getChildren Optional child loader used for folder merge recursion.
 * @param depth Current recursion depth for guarding pathological trees.
 * @returns CopyOperationPlan with ready or needs-decision status.
 */
export function planCopyOperations({
  items,
  targetParentId,
  targetItems,
  decisions = {},
  defaultConflictDecision,
  getChildren,
  depth = 0,
}: {
  items: Array<OperationPlannerItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth?: number
}): CopyOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar copy planning depth exceeded`)
  }
  const context: CopyPlannerContext = {
    targetParentId,
    targetItems,
    decisions,
    defaultConflictDecision,
    getChildren,
    depth,
    conflicts: [],
    operations: [],
    reservedNames: targetItems.map((item) => item.name),
  }

  for (const item of normalizePlannerRootItemsStrict(items, getChildren, depth)) {
    planCopyItem(context, item)
  }

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations: context.operations }
}
