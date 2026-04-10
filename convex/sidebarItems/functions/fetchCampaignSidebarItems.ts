import { asyncMap } from 'convex-helpers'
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

  return (
    await asyncMap(rawItems, async (raw) => {
      const item = await getSidebarItem(ctx, raw._id)
      return item ? enhanceSidebarItem(ctx, { item }) : null
    })
  ).filter((item): item is NonNullable<typeof item> => item !== null)
}
