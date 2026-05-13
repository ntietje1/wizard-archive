import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type {
  ConflictDecision,
  ConflictDecisionAction,
  ItemOperationConflict,
} from './operationTypes'
import type { OperationPlannerItem } from './selection'

export type PlannerItemStatus = 'ready' | 'needs-decision'

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

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecisionAction
}

export function toDecisionRecord(
  decisions: Array<OperationDecision> | undefined,
): Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> {
  const record: Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> = {}
  for (const decision of decisions ?? []) {
    if (decision.sourceItemId in record) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Repeated conflict decision for sidebar item ${decision.sourceItemId}`,
      )
    }
    record[decision.sourceItemId] = { action: decision.action }
  }
  return record
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

  switch (decision.action) {
    case 'skip':
      return 'ready'
    case 'keepBoth':
      handlers.keepBoth()
      return 'ready'
    case 'replace':
      if (
        item.type === SIDEBAR_ITEM_TYPES.folders &&
        conflictTarget.type === SIDEBAR_ITEM_TYPES.folders
      ) {
        return handlers.mergeFolders()
      }
      handlers.replace()
      return 'ready'
    default:
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Unknown conflict decision action: ${JSON.stringify(decision.action)}`,
      )
  }
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
    itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
    depth: number
    conflicts: Array<ItemOperationConflict>
    operations: Array<TOperation>
    defaultConflictDecision?: ConflictDecision
    mode: 'copy' | 'move'
  }
  item: OperationPlannerItem
  conflictTarget: OperationPlannerItem
  planChildren: (args: {
    mode: 'copy' | 'move'
    items: Array<OperationPlannerItem>
    targetParentId: Id<'sidebarItems'>
    targetItems: Array<OperationPlannerItem>
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
    defaultConflictDecision?: ConflictDecision
    getChildren: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>
    itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, '_id' | 'parentId'>>
    depth: number
  }) =>
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
      mode: context.mode,
      items: context.getChildren(item._id),
      targetParentId: conflictTarget._id,
      targetItems: context.getChildren(conflictTarget._id),
      decisions: context.decisions,
      defaultConflictDecision: context.decisions[item._id] ?? context.defaultConflictDecision,
      getChildren: context.getChildren,
      itemsById: context.itemsById,
      depth: context.depth + 1,
    })
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
