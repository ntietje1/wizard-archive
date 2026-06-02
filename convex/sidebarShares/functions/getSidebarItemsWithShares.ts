import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { resolveInheritedPermissions } from './sidebarItemPermissions'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { SidebarItemShare } from '../../../shared/sidebar-shares/types'

export interface SidebarItemWithShares {
  sidebarItemId: Id<'sidebarItems'>
  allPermissionLevel: PermissionLevel | null
  inheritShares: boolean | null
  shares: Array<SidebarItemShare>
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel>
  memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string>
}

async function getShareInfoForSidebarItem(
  ctx: CampaignQueryCtx,
  sidebarItemId: Id<'sidebarItems'>,
): Promise<SidebarItemWithShares> {
  const itemFromDb = await getSidebarItem(ctx, sidebarItemId)
  if (itemFromDb && itemFromDb.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Item does not belong to this campaign')
  }
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', item.campaignId))
    .collect()
  const playerMemberIds = members
    .filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)
    .map((m) => m._id)

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', item.campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: item.parentId,
    campaignId: item.campaignId,
    memberIds: playerMemberIds,
  })

  const memberInheritedPermissions: Record<Id<'campaignMembers'>, PermissionLevel> = {}
  const memberInheritedFromFolderNames: Record<Id<'campaignMembers'>, string> = {}
  for (const memberId of playerMemberIds) {
    const entry = inherited.members[memberId]
    memberInheritedPermissions[memberId] = entry?.level ?? PERMISSION_LEVEL.NONE
    if (entry?.folderName) {
      memberInheritedFromFolderNames[memberId] = entry.folderName
    }
  }

  return {
    sidebarItemId,
    allPermissionLevel: item.allPermissionLevel,
    inheritShares: item.type === SIDEBAR_ITEM_TYPES.folders ? item.inheritShares : null,
    shares,
    inheritedAllPermissionLevel: inherited.allPlayers.level,
    inheritedFromFolderName: inherited.allPlayers.folderName,
    memberInheritedPermissions,
    memberInheritedFromFolderNames,
  }
}

export async function getSidebarItemsWithShares(
  ctx: CampaignQueryCtx,
  { sidebarItemIds }: { sidebarItemIds: Array<Id<'sidebarItems'>> },
): Promise<Array<SidebarItemWithShares>> {
  return await Promise.all(
    sidebarItemIds.map((sidebarItemId) => getShareInfoForSidebarItem(ctx, sidebarItemId)),
  )
}
