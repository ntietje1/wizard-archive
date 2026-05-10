import { deduplicateName } from '../functions/defaultItemName'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflictPlanning'
import type { PlannerItemStatus } from './conflictPlanning'
import { removeSelectedDescendants } from './selectedRoots'
import type { OperationPlannerItem } from './selectedRoots'
import type { Id } from '../../_generated/dataModel'
import type {
  ConflictDecision,
  DuplicateOperation,
  DuplicateOperationPlan,
  ItemOperationConflict,
} from './types'

const MAX_OPERATION_DEPTH = 50

type DuplicatePlannerContext = {
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth: number
  conflicts: Array<ItemOperationConflict>
  operations: Array<DuplicateOperation>
  reservedNames: Array<string>
}

function addCopyOperation(context: DuplicatePlannerContext, item: OperationPlannerItem) {
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
  context: DuplicatePlannerContext,
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
  context: DuplicatePlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): PlannerItemStatus {
  return addPlannedFolderMergeOperations({
    context,
    item,
    conflictTarget,
    planChildren: planDuplicateOperations,
    createMergeOperation: ({
      sourceItemId,
      targetParentId,
      destinationItemId,
    }): DuplicateOperation => ({
      sourceItemId,
      action: 'mergeFolder',
      targetParentId,
      destinationItemId,
    }),
  })
}

function planDuplicateItem(
  context: DuplicatePlannerContext,
  item: OperationPlannerItem,
): PlannerItemStatus {
  const conflictTarget = findNameConflict(item, context.targetItems)
  if (!conflictTarget) {
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
 * Builds a batch duplicate plan for sidebar items without mutating storage.
 *
 * @param items Selected OperationPlannerItem roots to duplicate.
 * @param targetParentId Destination parent for copied items.
 * @param targetItems Existing siblings in the destination parent.
 * @param decisions Optional conflict decisions keyed by source item id.
 * @param getChildren Optional child loader used for folder merge recursion.
 * @param depth Current recursion depth for guarding pathological trees.
 * @returns DuplicateOperationPlan with ready, needs-decision, or cancelled status.
 */
export function planDuplicateOperations({
  items,
  targetParentId,
  targetItems,
  decisions = {},
  getChildren,
  depth = 0,
}: {
  items: Array<OperationPlannerItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth?: number
}): DuplicateOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar duplicate planning depth exceeded`)
  }
  const context: DuplicatePlannerContext = {
    targetParentId,
    targetItems,
    decisions,
    getChildren,
    depth,
    conflicts: [],
    operations: [],
    reservedNames: targetItems.map((item) => item.name),
  }

  for (const item of removeSelectedDescendants(items, getChildren, depth)) {
    const status = planDuplicateItem(context, item)
    if (status === 'cancelled') {
      return { status: 'cancelled', conflicts: [], operations: [] }
    }
  }

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations: context.operations }
}
