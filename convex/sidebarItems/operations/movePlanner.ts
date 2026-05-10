import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
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
  ItemOperationConflict,
  MoveOperation,
  MoveOperationPlan,
} from './types'

const MAX_OPERATION_DEPTH = 50

type MovePlannerContext = {
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth: number
  movingIds: Set<Id<'sidebarItems'>>
  conflicts: Array<ItemOperationConflict>
  operations: Array<MoveOperation>
  reservedNames: Array<string>
}

function addMoveOperation(context: MovePlannerContext, item: OperationPlannerItem, name: string) {
  context.operations.push({
    sourceItemId: item._id,
    action: 'move',
    targetParentId: context.targetParentId,
    ...(name !== item.name ? { name } : {}),
  })
  context.reservedNames.push(name)
}

function addKeepBothOperation(context: MovePlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item._id,
    action: 'move',
    targetParentId: context.targetParentId,
    name,
  })
  context.reservedNames.push(name)
}

function addReplaceOperation(
  context: MovePlannerContext,
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
  context: MovePlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): PlannerItemStatus {
  return addPlannedFolderMergeOperations({
    context,
    item,
    conflictTarget,
    planChildren: planMoveOperations,
    createMergeOperation: ({ sourceItemId, targetParentId, destinationItemId }): MoveOperation => ({
      sourceItemId,
      action: 'mergeFolder',
      targetParentId,
      destinationItemId,
    }),
  })
}

function planMoveItem(context: MovePlannerContext, item: OperationPlannerItem): PlannerItemStatus {
  const candidates = context.targetItems.filter(
    (targetItem) => !context.movingIds.has(targetItem._id),
  )
  const conflictTarget = findNameConflict(item, candidates)
  if (
    !conflictTarget &&
    item.parentId === context.targetParentId &&
    item.location !== SIDEBAR_ITEM_LOCATION.trash
  ) {
    context.reservedNames.push(item.name)
    return 'ready'
  }

  if (!conflictTarget) {
    addMoveOperation(context, item, deduplicateName(item.name, context.reservedNames))
    return 'ready'
  }

  return applyConflictDecision(context, item, conflictTarget, {
    keepBoth: () => addKeepBothOperation(context, item),
    replace: () => addReplaceOperation(context, item, conflictTarget),
    mergeFolders: () => addFolderMergeOperations(context, item, conflictTarget),
  })
}

export function planMoveOperations({
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
}): MoveOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar move planning depth exceeded`)
  }
  const topLevelItems = removeSelectedDescendants(items, getChildren, depth)
  const movingIds = new Set(topLevelItems.map((item) => item._id))
  const context: MovePlannerContext = {
    targetParentId,
    targetItems,
    decisions,
    defaultConflictDecision,
    getChildren,
    depth,
    movingIds,
    conflicts: [],
    operations: [],
    reservedNames: Array.from(
      new Set(targetItems.filter((item) => !movingIds.has(item._id)).map((item) => item.name)),
    ),
  }

  for (const item of topLevelItems) {
    const status = planMoveItem(context, item)
    if (status === 'cancelled') {
      return { status: 'cancelled', conflicts: [], operations: [] }
    }
  }

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations: context.operations }
}
