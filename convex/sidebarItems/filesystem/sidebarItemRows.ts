import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export async function getSidebarItemRow(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
): Promise<Doc<'sidebarItems'> | null> {
  const item = await ctx.db.get('sidebarItems', itemId)
  if (!item || item.campaignId !== ctx.campaign._id) return null
  return item
}

export async function requireSidebarItemRow(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
  message = 'Item not found',
): Promise<Doc<'sidebarItems'>> {
  const item = await getSidebarItemRow(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, message)
  return item
}
