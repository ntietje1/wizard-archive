import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const fetchCampaignSidebarItems = async (
  ctx: AuthQueryCtx,
  { campaignId, location }: { campaignId: Id<'campaigns'>; location: SidebarItemLocation },
): Promise<Array<AnySidebarItem>> => {
  const rawItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q.eq('campaignId', campaignId).eq('location', location),
    )
    .collect()

  const items = await Promise.all(rawItems.map((raw) => getSidebarItem(ctx, raw._id)))

  return await Promise.all(
    items
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => enhanceSidebarItem(ctx, { item })),
  )
}
