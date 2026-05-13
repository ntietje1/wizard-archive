import { asyncMap } from 'convex-helpers'
import { SIDEBAR_ITEM_STATUS } from '../types/baseTypes'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { AnySidebarItem } from '../types/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export const getActiveSidebarItemRowsByParent = async (
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'sidebarItems'> | null },
): Promise<Array<Doc<'sidebarItems'>>> => {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', SIDEBAR_ITEM_STATUS.active)
        .eq('parentId', parentId),
    )
    .collect()
}

export const getSidebarItemsByParent = async (
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'sidebarItems'> | null },
): Promise<Array<AnySidebarItem>> => {
  const rawItems = await getActiveSidebarItemRowsByParent(ctx, { parentId })

  return (
    await asyncMap(rawItems, async (raw) => {
      const item = await getSidebarItem(ctx, raw._id)
      return item ? enhanceSidebarItem(ctx, { item }) : null
    })
  ).filter((item): item is NonNullable<typeof item> => item !== null)
}
