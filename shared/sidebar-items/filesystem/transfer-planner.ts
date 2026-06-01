import type { SidebarItemId } from './types'
import { isTrashedSidebarItem } from '../types'
import { deduplicateName } from '../default-name'
import {
  addPlannedFolderMergeOperations,
  applyConflictDecision,
  findNameConflict,
} from './conflicts'
import { normalizeSelectedRoots } from './selection'
import type { ConflictDecision, ItemOperationConflict, PlannerItemStatus } from './conflicts'
import type { OperationPlannerItem } from './selection'

const MAX_OPERATION_DEPTH = 50
const MAX_ERROR_ITEMS = 10

export type TransferMode = 'copy' | 'move'
export type TransferOperation =
  | {
      sourceItemId: SidebarItemId
      action: 'place'
      targetParentId: SidebarItemId | null
      name?: string
    }
  | {
      sourceItemId: SidebarItemId
      action: 'replace'
      targetParentId: SidebarItemId | null
      destinationItemId: SidebarItemId
      name: string
    }
  | {
      sourceItemId: SidebarItemId
      action: 'mergeFolder'
      targetParentId: SidebarItemId | null
      destinationItemId: SidebarItemId
    }
export type TransferOperationPlan =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<TransferOperation>
      skippedSourceItemIds?: Array<SidebarItemId>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }

type TransferPlannerContext = {
  mode: TransferMode
  targetParentId: SidebarItemId | null
  targetItems: Array<OperationPlannerItem>
  decisions: Partial<Record<SidebarItemId, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  getChildren?: (parentId: SidebarItemId) => Array<OperationPlannerItem>
  itemsById: ReadonlyMap<SidebarItemId, Pick<OperationPlannerItem, '_id' | 'parentId'>>
  depth: number
  movingIds: Set<SidebarItemId>
  conflicts: Array<ItemOperationConflict>
  operations: Array<TransferOperation>
  reservedNames: Array<string>
  usedDecisionSourceIds: Set<SidebarItemId>
  skippedSourceItemIds: Set<SidebarItemId>
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

function assertDecisionsMatchConflicts({
  decisions,
  usedDecisionSourceIds,
}: {
  decisions: Partial<Record<SidebarItemId, ConflictDecision>>
  usedDecisionSourceIds: ReadonlySet<SidebarItemId>
}) {
  for (const sourceItemId of Object.keys(decisions) as Array<SidebarItemId>) {
    if (usedDecisionSourceIds.has(sourceItemId)) continue
    throw new Error('Conflict decision does not match an item with a conflict')
  }
}

export function planTransferOperations({
  mode,
  items,
  targetParentId,
  targetItems,
  decisions = {},
  defaultConflictDecision,
  usedDecisionSourceIds = new Set<SidebarItemId>(),
  skippedSourceItemIds = new Set<SidebarItemId>(),
  getChildren,
  itemsById,
  depth = 0,
}: {
  mode: TransferMode
  items: Array<OperationPlannerItem>
  itemsById: ReadonlyMap<SidebarItemId, Pick<OperationPlannerItem, '_id' | 'parentId'>>
  targetParentId: SidebarItemId | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Partial<Record<SidebarItemId, ConflictDecision>>
  defaultConflictDecision?: ConflictDecision
  usedDecisionSourceIds?: Set<SidebarItemId>
  skippedSourceItemIds?: Set<SidebarItemId>
  getChildren?: (parentId: SidebarItemId) => Array<OperationPlannerItem>
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
    usedDecisionSourceIds,
    skippedSourceItemIds,
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
