import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { checkItemAccess } from '../validation/access'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import { isUndoHiddenSidebarItem } from '../types/status'
import type { SidebarItemSlug } from '../../../shared/sidebar-items/slug'
import type { AnySidebarItemWithContent } from '../../../shared/sidebar-items/model-types'
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
  if (isUndoHiddenSidebarItem(raw)) return null

  const item = await getSidebarItem(ctx, raw._id)
  if (!item) return null

  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null

  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
