import type { SidebarItemId } from './types'
import { SIDEBAR_ITEM_TYPES } from '../types'
import type { OperationPlannerItem } from './selection'

export type PlannerItemStatus = 'ready' | 'needs-decision'
export type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth'
export type ConflictDecision = {
  action: ConflictDecisionAction
}
export type ItemOperationConflict = {
  kind: 'name-conflict'
  sourceItemId: SidebarItemId
  destinationItemId: SidebarItemId
  sourceName: string
  destinationName: string
  sourceType: OperationPlannerItem['type']
  destinationType: OperationPlannerItem['type']
}

type ConflictPlanningContext = {
  decisions: Partial<Record<SidebarItemId, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  conflicts: Array<ItemOperationConflict>
  usedDecisionSourceIds: Set<SidebarItemId>
  skippedSourceItemIds: Set<SidebarItemId>
}

type ConflictDecisionHandlers = {
  keepBoth: () => void
  replace: () => void
  mergeFolders: () => PlannerItemStatus
}

export type OperationDecision = {
  sourceItemId: SidebarItemId
  action: ConflictDecisionAction
}

export function toDecisionRecord(
  decisions: Array<OperationDecision> | undefined,
): Partial<Record<SidebarItemId, { action: ConflictDecisionAction }>> {
  const record: Partial<Record<SidebarItemId, { action: ConflictDecisionAction }>> = {}
  for (const decision of decisions ?? []) {
    if (decision.sourceItemId in record) {
      throw new Error(`Repeated conflict decision for sidebar item ${decision.sourceItemId}`)
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
  const explicitDecision = context.decisions[item._id]
  const decision = explicitDecision ?? context.defaultConflictDecision
  if (!decision) {
    context.conflicts.push(createConflict(item, conflictTarget))
    return 'needs-decision'
  }
  if (explicitDecision) {
    context.usedDecisionSourceIds.add(item._id)
  }

  switch (decision.action) {
    case 'skip':
      context.skippedSourceItemIds.add(item._id)
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
      throw new Error(`Unknown conflict decision action: ${JSON.stringify(decision.action)}`)
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
    targetParentId: SidebarItemId | null
    decisions: Partial<Record<SidebarItemId, ConflictDecision>>
    getChildren?: (parentId: SidebarItemId) => Array<OperationPlannerItem>
    itemsById: ReadonlyMap<SidebarItemId, Pick<OperationPlannerItem, '_id' | 'parentId'>>
    depth: number
    conflicts: Array<ItemOperationConflict>
    operations: Array<TOperation>
    defaultConflictDecision?: ConflictDecision
    mode: 'copy' | 'move'
    usedDecisionSourceIds: Set<SidebarItemId>
    skippedSourceItemIds: Set<SidebarItemId>
  }
  item: OperationPlannerItem
  conflictTarget: OperationPlannerItem
  planChildren: (args: {
    mode: 'copy' | 'move'
    items: Array<OperationPlannerItem>
    targetParentId: SidebarItemId
    targetItems: Array<OperationPlannerItem>
    decisions: Partial<Record<SidebarItemId, ConflictDecision>>
    defaultConflictDecision?: ConflictDecision
    usedDecisionSourceIds: Set<SidebarItemId>
    skippedSourceItemIds: Set<SidebarItemId>
    getChildren: (parentId: SidebarItemId) => Array<OperationPlannerItem>
    itemsById: ReadonlyMap<SidebarItemId, Pick<OperationPlannerItem, '_id' | 'parentId'>>
    depth: number
  }) =>
    | { status: 'needs-decision'; conflicts: Array<ItemOperationConflict>; operations: [] }
    | {
        status: 'ready'
        conflicts: []
        operations: Array<TOperation>
        skippedSourceItemIds?: Array<SidebarItemId>
      }
  createMergeOperation: (args: {
    sourceItemId: SidebarItemId
    targetParentId: SidebarItemId | null
    destinationItemId: SidebarItemId
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
      usedDecisionSourceIds: context.usedDecisionSourceIds,
      skippedSourceItemIds: context.skippedSourceItemIds,
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
