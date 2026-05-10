import type { Id } from 'convex/_generated/dataModel'
import type { ConflictDecision } from 'convex/sidebarItems/operations/types'

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecision['action']
}

export function toDecisionArray(
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
): Array<OperationDecision> | undefined {
  if (!decisions) return undefined
  return Object.entries(decisions)
    .filter((entry): entry is [Id<'sidebarItems'>, ConflictDecision] => entry[1] !== undefined)
    .map(([sourceItemId, decision]) => ({
      sourceItemId,
      action: decision.action,
    }))
}
