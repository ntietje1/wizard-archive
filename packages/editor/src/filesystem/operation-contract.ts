import type { ResourceId } from '../workspace/resource-contract'
import { deduplicateName, normalizeResourceItemNameForComparison } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import { isTrashedSidebarItem } from '../workspace/items/status'
import { normalizeSelectedRoots } from './domain/selection-roots'
import type { ConflictDecision, ItemOperationConflict } from './operation-planner'
import type { ResourcePatchRow } from './patch-contract'
import type { ResourceOperationDecision } from './transaction-contract'

const MAX_TRANSFER_OPERATION_DEPTH = 50
const MAX_ERROR_ITEMS = 10

export type OperationPlannerItem = Pick<
  ResourcePatchRow,
  'id' | 'parentId' | 'name' | 'type' | 'status'
>

function toDecisionRecord(
  decisions: ReadonlyArray<ResourceOperationDecision> | undefined,
): Partial<Record<ResourceId, ConflictDecision>> {
  const record: Partial<Record<ResourceId, ConflictDecision>> = {}
  for (const decision of decisions ?? []) {
    if (decision.sourceItemId in record) {
      throw new Error(`Repeated conflict decision for sidebar item ${decision.sourceItemId}`)
    }
    record[decision.sourceItemId] = { action: decision.action }
  }
  return record
}

type TransferMode = 'copy' | 'move'
export type TransferOperation =
  | {
      sourceItemId: ResourceId
      action: 'place'
      targetParentId: ResourceId | null
      name?: string
    }
  | {
      sourceItemId: ResourceId
      action: 'replace'
      targetParentId: ResourceId | null
      destinationItemId: ResourceId
      name: string
    }
  | {
      sourceItemId: ResourceId
      action: 'mergeFolder'
      targetParentId: ResourceId | null
      destinationItemId: ResourceId
    }

type PlanTransferOperationsInput = {
  mode: TransferMode
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<ResourceId, Pick<OperationPlannerItem, 'id' | 'parentId'>>
  targetParentId: ResourceId | null
  targetItems: Array<OperationPlannerItem>
  decisions?: ReadonlyArray<ResourceOperationDecision>
  getChildren?: (parentId: ResourceId) => Array<OperationPlannerItem>
}

type TransferOperationPlan =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<TransferOperation>
      skippedSourceItemIds?: Array<ResourceId>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }

type PlannerItemStatus = 'ready' | 'needs-decision'
type InheritedConflictDecision = ConflictDecision | { action: 'useIncoming' }

type ConflictPlanningContext = {
  decisions: Partial<Record<ResourceId, ConflictDecision>>
  defaultConflictDecision?: InheritedConflictDecision
  conflicts: Array<ItemOperationConflict>
  usedDecisionSourceIds: Set<ResourceId>
  skippedSourceItemIds: Set<ResourceId>
}

type ConflictDecisionHandlers = {
  keepBoth: () => void
  replace: () => void
  mergeFolders: () => PlannerItemStatus
}

type TransferPlannerContext = {
  mode: TransferMode
  targetParentId: ResourceId | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<ResourceId, ConflictDecision>>
  defaultConflictDecision?: InheritedConflictDecision
  getChildren?: (parentId: ResourceId) => Array<OperationPlannerItem>
  itemsById: ReadonlyMap<ResourceId, Pick<OperationPlannerItem, 'id' | 'parentId'>>
  depth: number
  movingIds: Set<ResourceId>
  conflicts: Array<ItemOperationConflict>
  operations: Array<TransferOperation>
  consumedDestinationIds: Set<ResourceId>
  reservedNames: Array<string>
  usedDecisionSourceIds: Set<ResourceId>
  skippedSourceItemIds: Set<ResourceId>
}

function findNameConflict(
  item: OperationPlannerItem,
  targetItems: Array<OperationPlannerItem>,
): OperationPlannerItem | undefined {
  const name = normalizeResourceItemNameForComparison(item.name)
  return targetItems.find(
    (targetItem) => normalizeResourceItemNameForComparison(targetItem.name) === name,
  )
}

function createConflict(
  source: OperationPlannerItem,
  destination: OperationPlannerItem,
): ItemOperationConflict {
  return {
    kind: 'name-conflict',
    sourceItemId: source.id,
    destinationItemId: destination.id,
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
  const explicitDecision = context.decisions[item.id]
  const decision = explicitDecision ?? context.defaultConflictDecision
  if (!decision) {
    context.conflicts.push(createConflict(item, conflictTarget))
    return 'needs-decision'
  }
  if (explicitDecision) {
    context.usedDecisionSourceIds.add(item.id)
  }

  switch (decision.action) {
    case 'skip':
      context.skippedSourceItemIds.add(item.id)
      return 'ready'
    case 'keepBoth':
      handlers.keepBoth()
      return 'ready'
    case 'replace':
      if (item.type === RESOURCE_TYPES.folders && conflictTarget.type === RESOURCE_TYPES.folders) {
        throw new Error('Folder conflicts require mergeFolder decisions')
      }
      handlers.replace()
      return 'ready'
    case 'mergeFolder':
      if (item.type !== RESOURCE_TYPES.folders || conflictTarget.type !== RESOURCE_TYPES.folders) {
        throw new Error('mergeFolder decisions require a folder conflict')
      }
      return handlers.mergeFolders()
    case 'useIncoming':
      if (item.type === RESOURCE_TYPES.folders && conflictTarget.type === RESOURCE_TYPES.folders) {
        return handlers.mergeFolders()
      }
      handlers.replace()
      return 'ready'
    default:
      throw new Error(
        `Unknown conflict decision action: ${JSON.stringify((decision as { action: unknown }).action)}`,
      )
  }
}

function formatItemIdsForError(items: Array<OperationPlannerItem>): string {
  const visibleIds = items.slice(0, MAX_ERROR_ITEMS).map((item) => item.id)
  const suffix =
    items.length > MAX_ERROR_ITEMS ? ` ... (+${items.length - MAX_ERROR_ITEMS} more)` : ''
  return `${visibleIds.join(', ')}${suffix}`
}

function addPlaceOperation(context: TransferPlannerContext, item: OperationPlannerItem) {
  const name = deduplicateName(item.name, context.reservedNames)
  context.operations.push({
    sourceItemId: item.id,
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
  context.consumedDestinationIds.add(conflictTarget.id)
  context.operations.push({
    sourceItemId: item.id,
    action: 'replace',
    targetParentId: context.targetParentId,
    destinationItemId: conflictTarget.id,
    name: item.name,
  })
  context.reservedNames.push(item.name)
}

function addFolderMergeOperations(
  context: TransferPlannerContext,
  item: OperationPlannerItem,
  conflictTarget: OperationPlannerItem,
): PlannerItemStatus {
  if (context.getChildren) {
    const defaultChildDecision =
      context.decisions[item.id]?.action === 'mergeFolder'
        ? ({ action: 'useIncoming' } satisfies InheritedConflictDecision)
        : (context.decisions[item.id] ?? context.defaultConflictDecision)
    const childPlan = planTransferOperationsFromDecisionRecord({
      mode: context.mode,
      items: context.getChildren(item.id),
      targetParentId: conflictTarget.id,
      targetItems: context.getChildren(conflictTarget.id),
      decisions: context.decisions,
      defaultConflictDecision: defaultChildDecision,
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

  context.operations.push({
    sourceItemId: item.id,
    action: 'mergeFolder',
    targetParentId: context.targetParentId,
    destinationItemId: conflictTarget.id,
  })
  return 'ready'
}

function targetConflictCandidates(context: TransferPlannerContext) {
  return context.targetItems.filter((targetItem) => {
    if (context.consumedDestinationIds.has(targetItem.id)) return false
    return context.mode === 'copy' || !context.movingIds.has(targetItem.id)
  })
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

  if (conflictTarget.id === item.id) {
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
  decisions: Partial<Record<ResourceId, ConflictDecision>>
  usedDecisionSourceIds: ReadonlySet<ResourceId>
}) {
  for (const sourceItemId of Object.keys(decisions) as Array<ResourceId>) {
    if (usedDecisionSourceIds.has(sourceItemId)) continue
    throw new Error('Conflict decision does not match an item with a conflict')
  }
}

export function planTransferOperations({
  mode,
  items,
  targetParentId,
  targetItems,
  decisions,
  getChildren,
  itemsById,
}: PlanTransferOperationsInput): TransferOperationPlan {
  return planTransferOperationsFromDecisionRecord({
    mode,
    items,
    itemsById,
    targetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren,
    depth: 0,
    usedDecisionSourceIds: new Set<ResourceId>(),
    skippedSourceItemIds: new Set<ResourceId>(),
  })
}

function planTransferOperationsFromDecisionRecord({
  mode,
  items,
  targetParentId,
  targetItems,
  decisions = {},
  defaultConflictDecision,
  usedDecisionSourceIds,
  skippedSourceItemIds,
  getChildren,
  itemsById,
  depth = 0,
}: {
  mode: TransferMode
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<ResourceId, Pick<OperationPlannerItem, 'id' | 'parentId'>>
  targetParentId: ResourceId | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<ResourceId, ConflictDecision>>
  defaultConflictDecision?: InheritedConflictDecision
  usedDecisionSourceIds: Set<ResourceId>
  skippedSourceItemIds: Set<ResourceId>
  getChildren?: (parentId: ResourceId) => Array<OperationPlannerItem>
  depth?: number
}): TransferOperationPlan {
  if (depth > MAX_TRANSFER_OPERATION_DEPTH) {
    throw new Error(
      `Max sidebar ${mode} planning depth exceeded at depth ${depth} for target ${targetParentId ?? 'root'} with items ${formatItemIdsForError(items)}`,
    )
  }
  const roots = normalizeSelectedRoots(items, itemsById)
  const movingIds = new Set(roots.map((item) => item.id))
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
    consumedDestinationIds: new Set<ResourceId>(),
    usedDecisionSourceIds,
    skippedSourceItemIds,
    reservedNames:
      mode === 'copy'
        ? Array.from(new Set(targetItems.map((item) => item.name)))
        : Array.from(
            new Set(targetItems.filter((item) => !movingIds.has(item.id)).map((item) => item.name)),
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
