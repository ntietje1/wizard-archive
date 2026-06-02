import { asyncMap } from 'convex-helpers'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { Doc } from '../../_generated/dataModel'
import type { SIDEBAR_ITEM_STATUS, SidebarItemStatus } from '../../../shared/sidebar-items/types'
import type { AnySidebarItem } from '../../../shared/sidebar-items/model-types'
import type { CampaignQueryCtx } from '../../functions'

type VisibleSidebarItemStatus = Exclude<SidebarItemStatus, typeof SIDEBAR_ITEM_STATUS.undoHidden>

async function collectRawItemsByStatus(
  ctx: CampaignQueryCtx,
  status: VisibleSidebarItemStatus,
): Promise<Array<Doc<'sidebarItems'>>> {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('status', status),
    )
    .collect()
}

export const fetchCampaignSidebarItems = async (
  ctx: CampaignQueryCtx,
  { status }: { status: VisibleSidebarItemStatus },
): Promise<Array<AnySidebarItem>> => {
  const rawItems = await collectRawItemsByStatus(ctx, status)

  return (
    await asyncMap(rawItems, async (raw) => {
      const item = await getSidebarItem(ctx, raw._id)
      return item ? enhanceSidebarItem(ctx, { item }) : null
    })
  ).filter((item): item is NonNullable<typeof item> => item !== null)
}
