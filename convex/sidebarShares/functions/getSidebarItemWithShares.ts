import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { getSidebarItemSharesForItem } from './getSidebarItemSharesForItem'
import { resolveAllInheritedPermissions } from './sidebarItemPermissions'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const getSidebarItemWithShares = async (
  ctx: CampaignQueryCtx,
  {
    sidebarItemId,
    playerMemberIds,
  }: {
    sidebarItemId: SidebarItemId
    playerMemberIds: Array<Id<'campaignMembers'>>
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
  const itemFromDb = await ctx.db.get(sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  let inheritShares: boolean | null = null
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    inheritShares = item.inheritShares
  }

  // Always fetch individual shares
  const shares = await getSidebarItemSharesForItem(ctx, {
    sidebarItemId,
  })

  // Resolve all inherited permissions in a single ancestor walk
  const inherited = await resolveAllInheritedPermissions(ctx, {
    parentId: item.parentId ?? null,
    memberIds: playerMemberIds,
  })

  // Map batched result back into the existing return shape
  const memberInheritedPermissions: Record<
    Id<'campaignMembers'>,
    PermissionLevel
  > = {}
  const memberInheritedFromFolderNames: Record<
    Id<'campaignMembers'>,
    string
  > = {}
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
