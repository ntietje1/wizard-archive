import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { unshareSidebarItemFromMember } from './sidebarItemShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const unshareSidebarItem = async (
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  const memberProfile = member ? await ctx.db.get('userProfiles', member.userId) : null

  await unshareSidebarItemFromMember(ctx, {
    sidebarItemId,
    campaignMemberId,
  })

  await logEditHistory(ctx, {
    itemId: sidebarItemId,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName: memberProfile?.name ?? 'Unknown',
      level: null,
      previousLevel: null,
    },
  })

  return null
}
