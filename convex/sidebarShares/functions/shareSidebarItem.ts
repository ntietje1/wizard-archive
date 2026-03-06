import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { shareSidebarItemWithMember } from './sidebarItemShareMutations'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../../sidebarItems/types/baseTypes'

export const shareSidebarItem = async (
  ctx: AuthMutationCtx,
  {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  }: {
    sidebarItemId: SidebarItemId
    sidebarItemType: SidebarItemType
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: PermissionLevel | null
  },
): Promise<Id<'sidebarItemShares'>> => {
  const item = await ctx.db.get(sidebarItemId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, item!.campaignId)

  return await shareSidebarItemWithMember(ctx, {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  })
}
