import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { deduplicateName } from './defaultItemName'
import type { AnySidebarItem } from '../types/types'
import type { Id } from '../../_generated/dataModel'

export type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth' | 'cancel'
const MAX_OPERATION_DEPTH = 50

export type ConflictDecision = {
  action: ConflictDecisionAction
}

type DuplicateCopyOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'copy'
  targetParentId: Id<'sidebarItems'> | null
  name: string
}

type DuplicateSkipOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'skip'
}

type DuplicateReplaceOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'replace'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
  name: string
}

type DuplicateMergeFolderOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'mergeFolder'
  destinationItemId: Id<'sidebarItems'>
}

export type DuplicateOperation =
  | DuplicateCopyOperation
  | DuplicateSkipOperation
  | DuplicateReplaceOperation
  | DuplicateMergeFolderOperation

type MoveItemOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'move'
  targetParentId: Id<'sidebarItems'> | null
  name?: string
}

type MoveSkipOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'skip'
}

type MoveReplaceOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'replace'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
  name: string
}

type MoveMergeFolderOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'mergeFolder'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
}

export type MoveOperation =
  | MoveItemOperation
  | MoveSkipOperation
  | MoveReplaceOperation
  | MoveMergeFolderOperation

export type ItemOperationConflict = {
  kind: 'name-conflict'
  sourceItemId: Id<'sidebarItems'>
  destinationItemId: Id<'sidebarItems'>
  sourceName: string
  destinationName: string
  sourceType: AnySidebarItem['type']
  destinationType: AnySidebarItem['type']
}

export type DuplicateOperationPlan =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<DuplicateOperation>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }
  | {
      status: 'cancelled'
      conflicts: []
      operations: []
    }

export type MoveOperationPlan =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<MoveOperation>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }
  | {
      status: 'cancelled'
      conflicts: []
      operations: []
    }

function normalizedName(name: string) {
  return name.trim().toLowerCase()
}

function findNameConflict(item: AnySidebarItem, targetItems: Array<AnySidebarItem>) {
  const name = normalizedName(item.name)
  return targetItems.find((targetItem) => normalizedName(targetItem.name) === name)
}

function createConflict(
  source: AnySidebarItem,
  destination: AnySidebarItem,
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

function removeSelectedDescendants(
  items: Array<AnySidebarItem>,
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<AnySidebarItem>,
  depth = 0,
): Array<AnySidebarItem> {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar operation depth exceeded while normalizing selection`)
  }

  const selectedIds = new Set(items.map((item) => item._id))
  const descendantIds = new Set<Id<'sidebarItems'>>()

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
      parentId = items.find((candidate) => candidate._id === parentId)?.parentId ?? null
    }
    return true
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
  items: Array<AnySidebarItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<AnySidebarItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<AnySidebarItem>
  depth?: number
}): DuplicateOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar duplicate planning depth exceeded`)
  }
  const conflicts: Array<ItemOperationConflict> = []
  const operations: Array<DuplicateOperation> = []
  const reservedNames: Array<string> = targetItems.map((item) => item.name)

  for (const item of removeSelectedDescendants(items, getChildren, depth)) {
    const conflictTarget = findNameConflict(item, targetItems)
    if (!conflictTarget) {
      const name = deduplicateName(item.name, reservedNames)
      operations.push({
        sourceItemId: item._id,
        action: 'copy',
        targetParentId,
        name,
      })
      reservedNames.push(name)
      continue
    }

    const decision = decisions[item._id]
    if (!decision) {
      conflicts.push(createConflict(item, conflictTarget))
      continue
    }

    if (decision.action === 'cancel') {
      return { status: 'cancelled', conflicts: [], operations: [] }
    }

    if (decision.action === 'skip') {
      continue
    }

    if (decision.action === 'keepBoth') {
      const name = deduplicateName(item.name, reservedNames)
      operations.push({
        sourceItemId: item._id,
        action: 'copy',
        targetParentId,
        name,
      })
      reservedNames.push(name)
      continue
    }

    if (
      decision.action === 'replace' &&
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      conflictTarget.type === SIDEBAR_ITEM_TYPES.folders
    ) {
      if (getChildren) {
        const childPlan = planDuplicateOperations({
          items: getChildren(item._id),
          targetParentId: conflictTarget._id,
          targetItems: getChildren(conflictTarget._id),
          decisions,
          getChildren,
          depth: depth + 1,
        })
        if (childPlan.status === 'cancelled') {
          return { status: 'cancelled', conflicts: [], operations: [] }
        }
        if (childPlan.status === 'needs-decision') {
          conflicts.push(...childPlan.conflicts)
          continue
        }
        operations.push(...childPlan.operations)
      }
      operations.push({
        sourceItemId: item._id,
        action: 'mergeFolder',
        destinationItemId: conflictTarget._id,
      })
      continue
    }

    operations.push({
      sourceItemId: item._id,
      action: 'replace',
      targetParentId,
      destinationItemId: conflictTarget._id,
      name: item.name,
    })
    reservedNames.push(item.name)
  }

  if (conflicts.length > 0) {
    return { status: 'needs-decision', conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations }
}

export function planMoveOperations({
  items,
  targetParentId,
  targetItems,
  decisions = {},
  getChildren,
  depth = 0,
}: {
  items: Array<AnySidebarItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<AnySidebarItem>
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<AnySidebarItem>
  depth?: number
}): MoveOperationPlan {
  if (depth > MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar move planning depth exceeded`)
  }
  const conflicts: Array<ItemOperationConflict> = []
  const operations: Array<MoveOperation> = []
  const topLevelItems = removeSelectedDescendants(items, getChildren, depth)
  const movingIds = new Set(topLevelItems.map((item) => item._id))
  const reservedNames: Array<string> = targetItems
    .filter((item) => !movingIds.has(item._id))
    .map((item) => item.name)

  for (const item of topLevelItems) {
    const candidates = targetItems.filter((targetItem) => !movingIds.has(targetItem._id))
    const conflictTarget = findNameConflict(item, candidates)
    if (item.parentId === targetParentId && !decisions[item._id]) {
      reservedNames.push(item.name)
      continue
    }

    if (!conflictTarget) {
      const name = deduplicateName(item.name, reservedNames)
      operations.push({
        sourceItemId: item._id,
        action: 'move',
        targetParentId,
        ...(name !== item.name ? { name } : {}),
      })
      reservedNames.push(name)
      continue
    }

    const decision = decisions[item._id]
    if (!decision) {
      conflicts.push(createConflict(item, conflictTarget))
      continue
    }

    if (decision.action === 'cancel') {
      return { status: 'cancelled', conflicts: [], operations: [] }
    }

    if (decision.action === 'skip') {
      continue
    }

    if (decision.action === 'keepBoth') {
      const name = deduplicateName(item.name, reservedNames)
      operations.push({
        sourceItemId: item._id,
        action: 'move',
        targetParentId,
        name,
      })
      reservedNames.push(name)
      continue
    }

    if (
      decision.action === 'replace' &&
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      conflictTarget.type === SIDEBAR_ITEM_TYPES.folders
    ) {
      if (getChildren) {
        const childPlan = planMoveOperations({
          items: getChildren(item._id),
          targetParentId: conflictTarget._id,
          targetItems: getChildren(conflictTarget._id),
          decisions,
          getChildren,
          depth: depth + 1,
        })
        if (childPlan.status === 'cancelled') {
          return { status: 'cancelled', conflicts: [], operations: [] }
        }
        if (childPlan.status === 'needs-decision') {
          conflicts.push(...childPlan.conflicts)
          continue
        }
        operations.push(...childPlan.operations)
      }
      operations.push({
        sourceItemId: item._id,
        action: 'mergeFolder',
        targetParentId,
        destinationItemId: conflictTarget._id,
      })
      continue
    }

    operations.push({
      sourceItemId: item._id,
      action: 'replace',
      targetParentId,
      destinationItemId: conflictTarget._id,
      name: item.name,
    })
    reservedNames.push(item.name)
  }

  if (conflicts.length > 0) {
    return { status: 'needs-decision', conflicts, operations: [] }
  }

  return { status: 'ready', conflicts: [], operations }
}
