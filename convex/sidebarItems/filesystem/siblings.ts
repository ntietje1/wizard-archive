import { SIDEBAR_ITEM_STATUS } from '../types/baseTypes'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'

export async function findActiveSidebarChildByName(
  ctx: CampaignMutationCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
  },
): Promise<Doc<'sidebarItems'> | null> {
  const normalizedName = name.trim().toLowerCase()
  const siblings = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', SIDEBAR_ITEM_STATUS.active)
        .eq('parentId', parentId),
    )
    .collect()

  return siblings.find((item) => item.name.trim().toLowerCase() === normalizedName) ?? null
}
