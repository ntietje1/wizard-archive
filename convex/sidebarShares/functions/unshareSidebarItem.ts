import { requireItemAccess } from '../../sidebarItems/validation/access'
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
  const [itemFromDb, member] = await Promise.all([
    getSidebarItem(ctx, sidebarItemId),
    ctx.db.get('campaignMembers', campaignMemberId),
  ])
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (!member) {
    throw new Error(`Campaign member ${campaignMemberId} not found`)
  }

  const [memberProfile, existingShare] = await Promise.all([
    ctx.db.get('userProfiles', member.userId),
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q
          .eq('campaignId', item.campaignId)
          .eq('sidebarItemId', sidebarItemId)
          .eq('campaignMemberId', campaignMemberId),
      )
      .unique(),
  ])

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
      previousLevel: existingShare?.permissionLevel ?? null,
    },
  })

  return null
}
