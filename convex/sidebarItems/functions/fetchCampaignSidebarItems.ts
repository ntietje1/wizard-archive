import { asyncMap } from 'convex-helpers'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem } from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

export const fetchCampaignSidebarItems = async (
  ctx: CampaignQueryCtx,
  { location }: { location: SidebarItemLocation },
): Promise<Array<AnySidebarItem>> => {
  const rawItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('location', location),
    )
    .collect()

  return (
    await asyncMap(rawItems, async (raw) => {
      const item = await getSidebarItem(ctx, raw._id)
      return item ? enhanceSidebarItem(ctx, { item }) : null
    })
  ).filter((item): item is NonNullable<typeof item> => item !== null)
}
