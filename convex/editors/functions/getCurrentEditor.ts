import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'
import { requireCampaignMembership } from '../../functions'
import type { Editor } from '../types'

export async function getCurrentEditor(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId?: Id<'campaigns'> } = {},
): Promise<Editor | null> {
  if (!campaignId) {
    return null
  }

  await requireCampaignMembership(ctx, campaignId)

  const editor = await ctx.db
    .query('editor')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
    )
    .unique()

  return editor
}
