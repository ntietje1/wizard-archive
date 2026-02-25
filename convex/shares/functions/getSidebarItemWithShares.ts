import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireItemAccess } from '../../sidebarItems/validation'
import {
  getSidebarItemSharesForItem,
  resolveInheritedPermissionWithSource,
} from '../itemShares'
import { PERMISSION_LEVEL } from '../types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../campaigns/types'
import type { PermissionLevel, SidebarItemShare } from '../types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export const getSidebarItemWithShares = async (
  ctx: CampaignQueryCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<{
  allPermissionLevel: PermissionLevel | null
  inheritShares?: boolean
  shares: Array<SidebarItemShare>
  playerMembers: Array<CampaignMember>
  inheritedAllPermissionLevel?: PermissionLevel
  inheritedFromFolderName?: string
  memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel>
  memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string>
}> => {
  const itemFromDb = await ctx.db.get(sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  let inheritShares: boolean | undefined = undefined
  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    inheritShares = item.inheritShares
  }

  // Get player members
  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  // Always fetch individual shares
  const shares = await getSidebarItemSharesForItem(ctx, {
    sidebarItemId,
  })

  // Resolve inherited all-players permission level with source folder name
  const {
    level: inheritedAllPermissionLevel,
    folderName: inheritedFromFolderName,
  } = await resolveInheritedPermissionWithSource(ctx, {
    parentId: item.parentId,
  })

  // Resolve per-member inherited permissions with source folder names
  const memberInheritedPermissions: Record<
    Id<'campaignMembers'>,
    PermissionLevel
  > = {}
  const memberInheritedFromFolderNames: Record<
    Id<'campaignMembers'>,
    string
  > = {}
  await Promise.all(
    playerMembers.map(async (member) => {
      const { level, folderName } = await resolveInheritedPermissionWithSource(
        ctx,
        {
          parentId: item.parentId,
          memberId: member._id,
        },
      )
      memberInheritedPermissions[member._id] = level ?? PERMISSION_LEVEL.NONE
      if (folderName) {
        memberInheritedFromFolderNames[member._id] = folderName
      }
    }),
  )

  return {
    allPermissionLevel: item.allPermissionLevel,
    inheritShares,
    shares,
    playerMembers,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    memberInheritedPermissions,
    memberInheritedFromFolderNames,
  }
}
