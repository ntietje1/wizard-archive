import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { AnySidebarItemRow } from '../types/types'

export async function getSidebarItemRow(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
): Promise<AnySidebarItemRow | null> {
  const item = (await ctx.db.get('sidebarItems', itemId)) as AnySidebarItemRow | null
  if (!item || item.campaignId !== ctx.campaign._id) return null
  return item
}

export async function requireSidebarItemRow(
  ctx: CampaignQueryCtx,
  itemId: Id<'sidebarItems'>,
  message = 'Item not found',
): Promise<AnySidebarItemRow> {
  const item = await getSidebarItemRow(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, message)
  return item
}
