import { requireItemAccess } from '../../sidebarItems/validation'
import { shareSidebarItemWithMember } from '../itemShares'
import { PERMISSION_LEVEL } from '../types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../types'
import type { SidebarItemId, SidebarItemType } from '../../sidebarItems/types/baseTypes'

export const shareSidebarItem = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  }: {
    sidebarItemId: SidebarItemId
    sidebarItemType: SidebarItemType
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel?: PermissionLevel
  },
): Promise<Id<'sidebarItemShares'>> => {
  const item = await ctx.db.get(sidebarItemId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  return await shareSidebarItemWithMember(ctx, {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  })
}
