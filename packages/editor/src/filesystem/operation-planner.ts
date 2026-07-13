import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceKind } from '../workspace/resource-contract'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'

type ConflictDecisionAction = 'replace' | 'skip' | 'keepBoth' | 'mergeFolder'

export type ConflictDecision = {
  action: ConflictDecisionAction
}

export type ItemOperationConflict = {
  kind: 'name-conflict'
  sourceItemId: SidebarItemId
  destinationItemId: SidebarItemId
  sourceName: string
  destinationName: string
  sourceType: ResourceKind
  destinationType: ResourceKind
}

export function isFolderConflict(conflict: ItemOperationConflict) {
  return (
    conflict.sourceType === RESOURCE_TYPES.folders &&
    conflict.destinationType === RESOURCE_TYPES.folders
  )
}

export function resolveIncomingConflictDecision(conflict: ItemOperationConflict): ConflictDecision {
  return { action: isFolderConflict(conflict) ? 'mergeFolder' : 'replace' }
}
