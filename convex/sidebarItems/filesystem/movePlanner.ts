import { isTrashedSidebarItem } from '../types/status'
import { deduplicateName } from '../functions/defaultItemName'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflicts'
import type { PlannerItemStatus } from './conflicts'
import { normalizeSelectedRoots } from './selection'
import type { OperationPlannerItem } from './selection'
import type { Id } from '../../_generated/dataModel'
import type {
  ConflictDecision,
  ItemOperationConflict,
  MoveOperation,
  MoveOperationPlan,
} from './operationTypes'

const MAX_OPERATION_DEPTH = 50
const MAX_ERROR_ITEMS = 10

function formatItemIdsForError(items: Array<OperationPlannerItem>) {
  const visibleIds = items.slice(0, MAX_ERROR_ITEMS).map((item) => item._id)
  const suffix =
    items.length > MAX_ERROR_ITEMS ? ` ... (+${items.length - MAX_ERROR_ITEMS} more)` : ''
  return `${visibleIds.join(', ')}${suffix}`
}

type MovePlannerContext = {
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
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
  if (!conflictTarget && item.parentId === context.targetParentId && !isTrashedSidebarItem(item)) {
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
  itemsById,
  depth = 0,
}: {
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
  depth?: number
}): MoveOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(
      `Max sidebar move planning depth exceeded at depth ${depth} for target ${targetParentId ?? 'root'} with items ${formatItemIdsForError(items)}`,
    )
  }
  const topLevelItems = normalizeSelectedRoots(items, itemsById)
  const movingIds = new Set(topLevelItems.map((item) => item._id))
  const context: MovePlannerContext = {
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
    reservedNames: Array.from(
      new Set(targetItems.filter((item) => !movingIds.has(item._id)).map((item) => item.name)),
    ),
  }

  for (const item of topLevelItems) {
    planMoveItem(context, item)
  }

  if (context.conflicts.length > 0) {
    return { status: 'needs-decision', conflicts: context.conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations: context.operations }
}
