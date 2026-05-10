import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { ConflictDecision, ItemOperationConflict } from './types'
import type { OperationPlannerItem } from './selectedRoots'

export type PlannerItemStatus = 'ready' | 'cancelled' | 'needs-decision'

export type ConflictPlanningContext = {
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  conflicts: Array<ItemOperationConflict>
}

export type ConflictDecisionHandlers = {
  keepBoth: () => void
  replace: () => void
  mergeFolders: () => PlannerItemStatus
}

export function normalizedName(name: string): string {
  return name.trim().toLowerCase()
}

export function findNameConflict(
  item: OperationPlannerItem,
  targetItems: Array<OperationPlannerItem>,
): OperationPlannerItem | undefined {
  const name = normalizedName(item.name)
  return targetItems.find((targetItem) => normalizedName(targetItem.name) === name)
}

function createConflict(
  source: OperationPlannerItem,
  destination: OperationPlannerItem,
): ItemOperationConflict {
  return {
    kind: 'name-conflict',
    sourceItemId: source._id,
    destinationItemId: destination._id,
    sourceName: source.name,
    destinationName: destination.name,
    sourceType: source.type,
    destinationType: destination.type,
  }
}

export function applyConflictDecision(
  context: ConflictPlanningContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
  handlers: ConflictDecisionHandlers,
): PlannerItemStatus {
  const decision = context.decisions[item._id] ?? context.defaultConflictDecision
  if (!decision) {
    context.conflicts.push(createConflict(item, conflictTarget))
    return 'needs-decision'
  }

  if (decision.action === 'cancel') return 'cancelled'
  if (decision.action === 'skip') return 'ready'
  if (decision.action === 'keepBoth') {
    handlers.keepBoth()
    return 'ready'
  }

  if (
    item.type === SIDEBAR_ITEM_TYPES.folders &&
    conflictTarget.type === SIDEBAR_ITEM_TYPES.folders
  ) {
    return handlers.mergeFolders()
  }

  handlers.replace()
  return 'ready'
}

export function addPlannedFolderMergeOperations<TOperation>({
  context,
  item,
  conflictTarget,
  planChildren,
  createMergeOperation,
}: {
  context: {
    targetParentId: Id<'sidebarItems'> | null
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
    getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
    depth: number
    conflicts: Array<ItemOperationConflict>
    operations: Array<TOperation>
    defaultConflictDecision?: ConflictDecision
  }
  item: OperationPlannerItem
  conflictTarget: OperationPlannerItem
  planChildren: (args: {
    items: Array<OperationPlannerItem>
    targetParentId: Id<'sidebarItems'>
    targetItems: Array<OperationPlannerItem>
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
    defaultConflictDecision?: ConflictDecision
    getChildren: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
    depth: number
  }) =>
    | { status: 'cancelled'; conflicts: []; operations: [] }
    | { status: 'needs-decision'; conflicts: Array<ItemOperationConflict>; operations: [] }
    | { status: 'ready'; conflicts: []; operations: Array<TOperation> }
  createMergeOperation: (args: {
    sourceItemId: Id<'sidebarItems'>
    targetParentId: Id<'sidebarItems'> | null
    destinationItemId: Id<'sidebarItems'>
  }) => TOperation
}): PlannerItemStatus {
  if (context.getChildren) {
    const childPlan = planChildren({
      items: context.getChildren(item._id),
      targetParentId: conflictTarget._id,
      targetItems: context.getChildren(conflictTarget._id),
      decisions: context.decisions,
      defaultConflictDecision: context.decisions[item._id] ?? context.defaultConflictDecision,
      getChildren: context.getChildren,
      depth: context.depth + 1,
    })
    if (childPlan.status === 'cancelled') return 'cancelled'
    if (childPlan.status === 'needs-decision') {
      context.conflicts.push(...childPlan.conflicts)
      return 'needs-decision'
    }
    context.operations.push(...childPlan.operations)
  }

  context.operations.push(
    createMergeOperation({
      sourceItemId: item._id,
      targetParentId: context.targetParentId,
      destinationItemId: conflictTarget._id,
    }),
  )
  return 'ready'
}
