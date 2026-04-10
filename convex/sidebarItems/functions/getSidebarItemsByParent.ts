import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { AnySidebarItem } from '../types/types'
import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export const getSidebarItemsByParent = async (
  ctx: AuthQueryCtx,
  { campaignId, parentId }: { campaignId: Id<'campaigns'>; parentId: Id<'sidebarItems'> | null },
): Promise<Array<AnySidebarItem>> => {
  const rawItems = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('location', SIDEBAR_ITEM_LOCATION.sidebar)
        .eq('parentId', parentId),
    )
    .collect()

  const items = await Promise.all(rawItems.map((raw) => getSidebarItem(ctx, raw._id)))

  return await Promise.all(
    items
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => enhanceSidebarItem(ctx, { item })),
  )
}
