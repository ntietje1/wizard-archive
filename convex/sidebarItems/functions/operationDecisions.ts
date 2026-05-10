import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { ConflictDecisionAction } from '../operations/types'

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecisionAction
}

/**
 * Converts conflict decisions into a lookup keyed by source sidebar item id.
 *
 * @param decisions Array of operation decisions, or undefined when no decisions were supplied.
 * @returns A partial record of source item ids to conflict decision actions.
 * @throws ClientError with VALIDATION_FAILED when decisions contain duplicate sourceItemId values.
 */
export function toDecisionRecord(
  decisions: Array<OperationDecision> | undefined,
): Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> {
  const record: Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>> = {}
  for (const decision of decisions ?? []) {
    if (decision.sourceItemId in record) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        `Duplicate conflict decision for sidebar item ${decision.sourceItemId}`,
      )
    }
    record[decision.sourceItemId] = { action: decision.action }
  }
  return record
}
