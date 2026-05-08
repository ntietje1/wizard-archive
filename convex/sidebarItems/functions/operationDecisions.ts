import type { Id } from '../../_generated/dataModel'
import type { ConflictDecisionAction } from '../operations/types'

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecisionAction
}

export function toDecisionRecord(decisions: Array<OperationDecision> | undefined) {
  return Object.fromEntries(
    (decisions ?? []).map((decision) => [decision.sourceItemId, { action: decision.action }]),
  ) as Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>>
}
