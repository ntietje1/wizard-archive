import { asyncMap } from 'convex-helpers'
import { hardDeleteItem } from '../../sidebarItems/functions/hardDeleteItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function deleteCampaign(
  ctx: AuthMutationCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Id<'campaigns'>> {
  await requireDmRole(ctx, campaignId)

  const rawItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) => q.eq('campaignId', campaignId))
    .collect()

  const items = await asyncMap(rawItems, (raw) => getSidebarItem(ctx, raw._id))

  for (const item of items) {
    if (item) await hardDeleteItem(ctx, item)
  }

  // Delete sessions
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const session of sessions) {
    await ctx.db.delete('sessions', session._id)
  }

  // Delete campaign members
  const campaignMembers = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const member of campaignMembers) {
    await ctx.db.delete('campaignMembers', member._id)
  }

  await ctx.db.delete('campaigns', campaignId)

  return campaignId
}
