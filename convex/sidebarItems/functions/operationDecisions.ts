import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { ConflictDecisionAction } from '../operations/types'

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecisionAction
}

export function toDecisionRecord(
  decisions: Array<OperationDecision> | undefined,
): Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> {
  const record: Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> = {}
  for (const decision of decisions ?? []) {
    if (record[decision.sourceItemId]) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Duplicate conflict decision for sidebar item')
    }
    record[decision.sourceItemId] = { action: decision.action }
  }
  return record
}
