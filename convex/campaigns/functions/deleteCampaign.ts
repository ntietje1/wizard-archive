import { hardDeleteItem } from '../../sidebarItems/functions/hardDeleteItem'
import { requireDmRole } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

const SIDEBAR_TABLES = ['folders', 'notes', 'gameMaps', 'files'] as const

export async function deleteCampaign(
  ctx: AuthMutationCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Id<'campaigns'>> {
  await requireDmRole(ctx, campaignId)

  // Delete all sidebar items (both active and trashed) with their dependents
  for (const table of SIDEBAR_TABLES) {
    const items = await ctx.db
      .query(table)
      .withIndex('by_campaign_location_parent_name', (q) => q.eq('campaignId', campaignId))
      .collect()

    for (const item of items) {
      await hardDeleteItem(ctx, item)
    }
  }

  // Delete sessions
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }

  // Delete campaign members
  const campaignMembers = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()

  for (const member of campaignMembers) {
    await ctx.db.delete(member._id)
  }

  await ctx.db.delete(campaignId)

  return campaignId
}
