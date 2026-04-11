import type { CampaignQueryCtx } from '../../functions'
import type { Editor } from '../types'

export async function getCurrentEditor(ctx: CampaignQueryCtx): Promise<Editor | null> {
  const campaignId = ctx.campaign._id

  const editor = await ctx.db
    .query('editor')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.membership.userId),
    )
    .unique()

  return editor
}
