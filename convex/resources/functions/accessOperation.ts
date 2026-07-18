import type { CampaignMemberId, OperationId } from '@wizard-archive/editor/resources/domain-id'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

type AccessOperationTable = 'noteBlockAccessOperations' | 'resourceAccessOperations'
type AccessOperation = Doc<'noteBlockAccessOperations'> | Doc<'resourceAccessOperations'>

export async function findAccessOperation(
  ctx: CampaignMutationCtx,
  table: 'noteBlockAccessOperations',
  operationId: OperationId,
): Promise<Doc<'noteBlockAccessOperations'> | null>
export async function findAccessOperation(
  ctx: CampaignMutationCtx,
  table: 'resourceAccessOperations',
  operationId: OperationId,
): Promise<Doc<'resourceAccessOperations'> | null>
export async function findAccessOperation(
  ctx: CampaignMutationCtx,
  table: AccessOperationTable,
  operationId: OperationId,
): Promise<AccessOperation | null> {
  const operations =
    table === 'noteBlockAccessOperations'
      ? ctx.db.query('noteBlockAccessOperations')
      : ctx.db.query('resourceAccessOperations')
  return await operations
    .withIndex('by_campaign_and_operation', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('operationUuid', operationId),
    )
    .unique()
}

export function accessOperationWasReused(
  operation: Readonly<{ actorMemberUuid: CampaignMemberId; fingerprint: string }>,
  actorId: CampaignMemberId,
  fingerprint: string,
) {
  return operation.actorMemberUuid !== actorId || operation.fingerprint !== fingerprint
}
