import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { resolveInheritedPermissions } from './sidebarItemPermissions'
import { getSidebarItem } from '../../sidebarItems/functions/loadExtensionData'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const getSidebarItemWithShares = async (
  ctx: AuthQueryCtx,
  {
    sidebarItemId,
  }: {
    sidebarItemId: SidebarItemId
  },
): Promise<{
  allPermissionLevel: PermissionLevel | null
  inheritShares: boolean | null
  shares: Array<SidebarItemShare>
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel>
  memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string>
}> => {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  await requireDmRole(ctx, item.campaignId)

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', item.campaignId))
    .collect()
  const playerMemberIds = members
    .filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
    .map((m) => m._id)

  let inheritShares: boolean | null = null
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    inheritShares = item.inheritShares
  }

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', item.campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: item.parentId ?? null,
    campaignId: item.campaignId,
    memberIds: playerMemberIds,
  })

  const memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel> = {}
  const memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string> = {}
  for (const memberId of playerMemberIds) {
    const entry = inherited.members[memberId]
    if (entry) {
      memberInheritedPermissions[memberId] = entry.level
      if (entry.folderName) {
        memberInheritedFromFolderNames[memberId] = entry.folderName
      }
    } else {
      memberInheritedPermissions[memberId] = PERMISSION_LEVEL.NONE
    }
  }

  return {
    allPermissionLevel: item.allPermissionLevel,
    inheritShares,
    shares,
    inheritedAllPermissionLevel: inherited.allPlayers.level,
    inheritedFromFolderName: inherited.allPlayers.folderName,
    memberInheritedPermissions,
    memberInheritedFromFolderNames,
  }
}
