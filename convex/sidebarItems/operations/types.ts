import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

export type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth' | 'cancel'

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
  targetParentId: Id<'sidebarItems'> | null
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
