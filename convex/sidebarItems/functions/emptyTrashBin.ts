import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { hardDeleteItem } from './hardDeleteItem'
import type { CampaignMutationCtx } from '../../functions'

export async function emptyTrashBin(ctx: CampaignMutationCtx): Promise<void> {
  const allTrashed = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('location', SIDEBAR_ITEM_LOCATION.trash),
    )
    .collect()

  for (const item of allTrashed) {
    await hardDeleteItem(ctx, item)
  }
}
