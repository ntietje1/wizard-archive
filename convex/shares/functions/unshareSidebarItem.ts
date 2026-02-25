import { requireItemAccess } from '../../sidebarItems/validation'
import { unshareSidebarItemFromMember } from '../itemShares'
import { PERMISSION_LEVEL } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const unshareSidebarItem = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: SidebarItemId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const item = await ctx.db.get(sidebarItemId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await unshareSidebarItemFromMember(ctx, {
    sidebarItemId,
    campaignMemberId,
  })

  return null
}
