import { PERMISSION_LEVEL } from '../../permissions/types'
import { checkItemAccess } from '../validation/access'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { SidebarItemSlug } from '../validation/slug'
import type { AnySidebarItemWithContent } from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemBySlug = async (
  ctx: CampaignQueryCtx,
  { slug }: { slug: SidebarItemSlug },
): Promise<AnySidebarItemWithContent | null> => {
  const raw = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', ctx.campaign._id).eq('slug', slug))
    .unique()

  if (!raw) return null

  const item = await getSidebarItem(ctx, raw._id)
  if (!item) return null

  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null

  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
