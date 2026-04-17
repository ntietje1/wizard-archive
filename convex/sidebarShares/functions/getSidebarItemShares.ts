import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation/validation'
import { getSidebarItemSharesForItem } from './getSidebarItemSharesForItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { SidebarItemShare } from '../types'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemShares = async (
  ctx: CampaignQueryCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
): Promise<Array<SidebarItemShare>> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  return await getSidebarItemSharesForItem(ctx, {
    sidebarItemId,
  })
}
