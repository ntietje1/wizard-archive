import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

export type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth'

export type ConflictDecision = {
  action: ConflictDecisionAction
}

type CopyItemOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'copy'
  targetParentId: Id<'sidebarItems'> | null
  name: string
}

type CopyReplaceOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'replace'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
  name: string
}

type CopyMergeFolderOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'mergeFolder'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
}

export type CopyOperation = CopyItemOperation | CopyReplaceOperation | CopyMergeFolderOperation

type MoveItemOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'move'
  targetParentId: Id<'sidebarItems'> | null
  name?: string
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

export type MoveOperation = MoveItemOperation | MoveReplaceOperation | MoveMergeFolderOperation

export type ItemOperationConflict = {
  kind: 'name-conflict'
  sourceItemId: Id<'sidebarItems'>
  destinationItemId: Id<'sidebarItems'>
  sourceName: string
  destinationName: string
  sourceType: AnySidebarItem['type']
  destinationType: AnySidebarItem['type']
}

export type OperationPlan<TOperation> =
  | {
      status: 'ready'
      conflicts: []
      operations: Array<TOperation>
    }
  | {
      status: 'needs-decision'
      conflicts: Array<ItemOperationConflict>
      operations: []
    }

export type CopyOperationPlan = OperationPlan<CopyOperation>

export type MoveOperationPlan = OperationPlan<MoveOperation>
