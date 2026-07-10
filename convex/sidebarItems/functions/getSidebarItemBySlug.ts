import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { checkItemAccess } from '../validation/access'
import { enhanceSidebarItemWithContent } from './enhanceSidebarItem'
import { getSidebarItem } from './getSidebarItem'
import { isUndoHiddenSidebarItem } from '../types/status'
import type {
  ResourceSlug,
  AnyResourceWithContent,
} from '@wizard-archive/editor/resources/resource-contract'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemBySlug = async (
  ctx: CampaignQueryCtx,
  { slug }: { slug: ResourceSlug },
): Promise<AnyResourceWithContent | null> => {
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
    requiredStatus: RESOURCE_STATUS.active,
  })
  if (!enhanced) return null

  return enhanceSidebarItemWithContent(ctx, { item: enhanced })
}
