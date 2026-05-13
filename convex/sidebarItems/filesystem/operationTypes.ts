import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

export type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth'

export type ConflictDecision = {
  action: ConflictDecisionAction
}

type PlaceTransferOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'place'
  targetParentId: Id<'sidebarItems'> | null
  name?: string
}

type ReplaceTransferOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'replace'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
  name: string
}

type MergeFolderTransferOperation = {
  sourceItemId: Id<'sidebarItems'>
  action: 'mergeFolder'
  targetParentId: Id<'sidebarItems'> | null
  destinationItemId: Id<'sidebarItems'>
}

export type TransferOperation =
  | PlaceTransferOperation
  | ReplaceTransferOperation
  | MergeFolderTransferOperation

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

export type TransferOperationPlan = OperationPlan<TransferOperation>
