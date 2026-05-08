import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { deduplicateName } from '../functions/defaultItemName'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItemRow } from '../types/types'
import type {
  ConflictDecision,
  DuplicateOperation,
  DuplicateOperationPlan,
  ItemOperationConflict,
  MoveOperation,
  MoveOperationPlan,
} from './types'

const MAX_OPERATION_DEPTH = 50
type OperationPlannerItem = Pick<
  AnySidebarItemRow,
  '_id' | 'parentId' | 'name' | 'type' | 'location'
>
type PlannerItemStatus = 'ready' | 'cancelled' | 'needs-decision'

type ConflictPlanningContext = {
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  conflicts: Array<ItemOperationConflict>
}

type ConflictDecisionHandlers = {
  keepBoth: () => void
  replace: () => void
  mergeFolders: () => PlannerItemStatus
}

function normalizedName(name: string) {
  return name.trim().toLowerCase()
}

function findNameConflict(item: OperationPlannerItem, targetItems: Array<OperationPlannerItem>) {
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

function applyConflictDecision(
  context: ConflictPlanningContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
  handlers: ConflictDecisionHandlers,
): PlannerItemStatus {
  const decision = context.decisions[item._id]
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

function removeSelectedDescendants(
  items: Array<OperationPlannerItem>,
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>,
  depth = 0,
): Array<OperationPlannerItem> {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar operation depth exceeded while normalizing selection`)
  }

  const selectedIds = new Set(items.map((item) => item._id))
  const itemsById = new Map(items.map((item) => [item._id, item]))
  const descendantIds = new Set<Id<'sidebarItems'>>()
  const normalizedIds = new Set<Id<'sidebarItems'>>()

  if (getChildren) {
    const collect = (parentId: Id<'sidebarItems'>, currentDepth: number) => {
      if (currentDepth >= MAX_OPERATION_DEPTH) {
        throw new Error(`Max sidebar operation depth exceeded at ${parentId}`)
      }
      for (const child of getChildren(parentId)) {
        descendantIds.add(child._id)
        if (child.type === SIDEBAR_ITEM_TYPES.folders) {
          collect(child._id, currentDepth + 1)
        }
      }
    }

    for (const item of items) {
      if (item.type === SIDEBAR_ITEM_TYPES.folders) {
        collect(item._id, depth)
      }
    }
  }

  return items.filter((item) => {
    if (descendantIds.has(item._id)) return false
    if (normalizedIds.has(item._id)) return false

    let parentId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>()
    while (parentId) {
      if (selectedIds.has(parentId)) return false
      if (seen.has(parentId)) {
        throw new Error(
          `Cycle detected while normalizing selected sidebar items at parent ${parentId} for item ${item._id}`,
        )
      }
      seen.add(parentId)
      parentId = itemsById.get(parentId)?.parentId ?? null
    }
    normalizedIds.add(item._id)
    return true
  })
}

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

function addDuplicateCopyOperation(context: DuplicatePlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item._id,
    action: 'copy',
    targetParentId: context.targetParentId,
    name,
  })
  context.reservedNames.push(name)
}

function addDuplicateReplaceOperation(
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

function addDuplicateFolderMergeOperations(
  context: DuplicatePlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): 'ready' | 'cancelled' | 'needs-decision' {
  if (context.getChildren) {
    const childPlan = planDuplicateOperations({
      items: context.getChildren(item._id),
      targetParentId: conflictTarget._id,
      targetItems: context.getChildren(conflictTarget._id),
      decisions: context.decisions,
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

  context.operations.push({
    sourceItemId: item._id,
    action: 'mergeFolder',
    destinationItemId: conflictTarget._id,
  })
  return 'ready'
}

function planDuplicateItem(
  context: DuplicatePlannerContext,
  item: OperationPlannerItem,
): PlannerItemStatus {
  const conflictTarget = findNameConflict(item, context.targetItems)
  if (!conflictTarget) {
    addDuplicateCopyOperation(context, item)
    return 'ready'
  }

  return applyConflictDecision(context, item, conflictTarget, {
    keepBoth: () => addDuplicateCopyOperation(context, item),
    replace: () => addDuplicateReplaceOperation(context, item, conflictTarget),
    mergeFolders: () => addDuplicateFolderMergeOperations(context, item, conflictTarget),
  })
}

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

type MovePlannerContext = {
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
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

function addMoveKeepBothOperation(context: MovePlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item._id,
    action: 'move',
    targetParentId: context.targetParentId,
    name,
  })
  context.reservedNames.push(name)
}

function addMoveReplaceOperation(
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

function addMoveFolderMergeOperations(
  context: MovePlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): 'ready' | 'cancelled' | 'needs-decision' {
  if (context.getChildren) {
    const childPlan = planMoveOperations({
      items: context.getChildren(item._id),
      targetParentId: conflictTarget._id,
      targetItems: context.getChildren(conflictTarget._id),
      decisions: context.decisions,
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

  context.operations.push({
    sourceItemId: item._id,
    action: 'mergeFolder',
    targetParentId: context.targetParentId,
    destinationItemId: conflictTarget._id,
  })
  return 'ready'
}

function planMoveItem(context: MovePlannerContext, item: OperationPlannerItem): PlannerItemStatus {
  const candidates = context.targetItems.filter(
    (targetItem) => !context.movingIds.has(targetItem._id),
  )
  const conflictTarget = findNameConflict(item, candidates)
  if (
    item.parentId === context.targetParentId &&
    item.location !== SIDEBAR_ITEM_LOCATION.trash &&
    !context.decisions[item._id]
  ) {
    context.reservedNames.push(item.name)
    return 'ready'
  }

  if (!conflictTarget) {
    addMoveOperation(context, item, deduplicateName(item.name, context.reservedNames))
    return 'ready'
  }

  return applyConflictDecision(context, item, conflictTarget, {
    keepBoth: () => addMoveKeepBothOperation(context, item),
    replace: () => addMoveReplaceOperation(context, item, conflictTarget),
    mergeFolders: () => addMoveFolderMergeOperations(context, item, conflictTarget),
  })
}

export function planMoveOperations({
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
    getChildren,
    depth,
    movingIds,
    conflicts: [],
    operations: [],
    reservedNames: targetItems.filter((item) => !movingIds.has(item._id)).map((item) => item.name),
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
