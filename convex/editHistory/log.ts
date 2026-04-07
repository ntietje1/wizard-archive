import { requireCampaignMembership } from '../functions'
import type { AuthMutationCtx } from '../functions'
import type { LogEditHistoryArgs } from './types'

export async function logEditHistory(
  ctx: AuthMutationCtx,
  args: LogEditHistoryArgs,
): Promise<void> {
  const { membership } = await requireCampaignMembership(ctx, args.campaignId)

  await ctx.db.insert('editHistory', {
    itemId: args.itemId,
    itemType: args.itemType,
    campaignId: args.campaignId,
    campaignMemberId: membership._id,
    action: args.action,
    metadata: args.metadata ?? null,
  })
}
