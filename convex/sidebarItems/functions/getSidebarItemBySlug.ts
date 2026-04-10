import { requireCampaignMembership } from '../../functions'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { checkItemAccess } from '../validation'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import type { AnySidebarItemWithContent } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemBySlug = async (
  ctx: AuthQueryCtx,
  { slug, campaignId }: { slug: string; campaignId: Id<'campaigns'> },
): Promise<AnySidebarItemWithContent | null> => {
  await requireCampaignMembership(ctx, campaignId)

  const raw = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_slug', (q) => q.eq('campaignId', campaignId).eq('slug', slug))
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
