import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { resolveInheritedPermissions } from './sidebarItemPermissions'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceShare } from '@wizard-archive/editor/resources/resource-contract'
import {
  loadSidebarItemShareIdentityProjection,
  projectSidebarItemShare,
} from './projectSidebarItemShare'
import type { SidebarItemShareIdentityProjection } from './projectSidebarItemShare'

export interface SidebarItemWithShares {
  sidebarItemId: ResourceId
  allPermissionLevel: PermissionLevel | null
  inheritShares: boolean | null
  shares: Array<ResourceShare>
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  memberInheritedPermissions: Record<CampaignMemberId, PermissionLevel>
  memberInheritedFromFolderNames: Record<CampaignMemberId, string>
}

async function getShareInfoForSidebarItem(
  ctx: CampaignQueryCtx,
  sidebarItemId: Id<'sidebarItems'>,
  playerMemberIds: Array<Id<'campaignMembers'>>,
  identities: SidebarItemShareIdentityProjection,
): Promise<SidebarItemWithShares> {
  const rawItem = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!rawItem) throw new Error('Resource provider row is missing')
  const itemRow = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemRow,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: rawItem.parentId,
    memberIds: playerMemberIds,
  })

  const memberInheritedPermissions: Record<CampaignMemberId, PermissionLevel> = {}
  const memberInheritedFromFolderNames: Record<CampaignMemberId, string> = {}
  for (const memberId of playerMemberIds) {
    const campaignMemberId = identities.memberIds.get(memberId)
    if (!campaignMemberId) throw new Error('Campaign member identity is missing')
    const entry = inherited.members[memberId]
    memberInheritedPermissions[campaignMemberId] = entry?.level ?? PERMISSION_LEVEL.NONE
    if (entry?.folderName) {
      memberInheritedFromFolderNames[campaignMemberId] = entry.folderName
    }
  }

  return {
    sidebarItemId: item.id,
    allPermissionLevel: item.allPermissionLevel,
    inheritShares: item.type === RESOURCE_TYPES.folders ? item.inheritShares : null,
    shares: shares.map((share) => projectSidebarItemShare(share, identities, item.id)),
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
  const { identities, members } = await loadSidebarItemShareIdentityProjection(ctx)
  const playerMemberIds = members
    .filter(
      (member) =>
        member.role === CAMPAIGN_MEMBER_ROLE.Player &&
        member.status === CAMPAIGN_MEMBER_STATUS.Accepted,
    )
    .map((member) => member._id)

  return await Promise.all(
    [...new Set(sidebarItemIds)].map((sidebarItemId) =>
      getShareInfoForSidebarItem(ctx, sidebarItemId, playerMemberIds, identities),
    ),
  )
}
