import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
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
  const itemFromDb = await ctx.db.get(sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await requireDmRole(ctx, item.campaignId)

  const existingShare = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', item.campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
  const previousLevel =
    existingShare && existingShare.deletionTime === null
      ? existingShare.permissionLevel
      : null

  const result = await shareSidebarItemWithMember(ctx, {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  })

  const member = await ctx.db.get(campaignMemberId)
  const memberProfile = member ? await ctx.db.get(member.userId) : null
  await logEditHistory(ctx, {
    itemId: sidebarItemId,
    itemType: item.type,
    campaignId: item.campaignId,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName: memberProfile?.name ?? 'Unknown',
      level: permissionLevel,
      previousLevel,
    },
  })

  return result
}
