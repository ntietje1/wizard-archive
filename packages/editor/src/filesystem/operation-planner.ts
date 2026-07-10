import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceKind } from '../workspace/resource-contract'

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
