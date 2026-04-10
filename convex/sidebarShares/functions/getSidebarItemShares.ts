import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireItemAccess } from '../../sidebarItems/validation'
import { requireDmRole } from '../../functions'
import { getSidebarItemSharesForItem } from './getSidebarItemSharesForItem'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemShare } from '../types'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemShares = async (
  ctx: AuthQueryCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
): Promise<Array<SidebarItemShare>> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  await requireDmRole(ctx, item.campaignId)
  return await getSidebarItemSharesForItem(ctx, {
    sidebarItemId,
  })
}
