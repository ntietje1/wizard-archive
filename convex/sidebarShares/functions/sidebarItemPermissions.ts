import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
} from '../../sidebarItems/types/types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../types'

export async function getSidebarItemPermissionLevel(
  ctx: CampaignQueryCtx,
  { item }: { item: AnySidebarItem | AnySidebarItemFromDb },
): Promise<PermissionLevel> {
  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.FULL_ACCESS
  }

  const checkId = ctx.membership._id

  // Check for an explicit per-player share
  const share: SidebarItemShare | null = await getSidebarItemShareForMember(
    ctx,
    {
      sidebarItemId: item._id,
      campaignMemberId: checkId,
    },
  )
  if (share) {
    return share.permissionLevel ?? PERMISSION_LEVEL.VIEW
  }

  // Check item's own explicit allPermissionLevel
  const allPerm = item.allPermissionLevel
  if (allPerm !== null) {
    return allPerm
  }

  // Walk up folder hierarchy for inherited permission
  const parentId = item.parentId ?? null
  return await resolveInheritedPermission(ctx, {
    parentId,
    playerId: checkId,
  })
}

async function resolveInheritedPermission(
  ctx: CampaignQueryCtx,
  {
    parentId,
    playerId,
  }: {
    parentId: Id<'folders'> | null
    playerId: Id<'campaignMembers'>
  },
): Promise<PermissionLevel> {
  const { level } = await resolveInheritedPermissionWithSource(ctx, {
    parentId,
    memberId: playerId,
  })
  return level ?? PERMISSION_LEVEL.NONE
}

export async function resolveInheritedPermissionWithSource(
  ctx: CampaignQueryCtx,
  {
    parentId,
    memberId,
  }: {
    parentId: Id<'folders'> | null
    memberId: Id<'campaignMembers'> | null
  },
): Promise<{ level: PermissionLevel | null; folderName: string | null }> {
  let currentParentId = parentId
  while (currentParentId) {
    const folder = await ctx.db.get(currentParentId)
    if (!folder) break

    // continue walking up until we find a folder that inherits shares
    if (!folder.inheritShares) {
      currentParentId = folder.parentId
      continue
    }

    // Check individual member share if memberId provided
    if (memberId) {
      const share = await getSidebarItemShareForMember(ctx, {
        sidebarItemId: currentParentId,
        campaignMemberId: memberId,
      })
      if (share) {
        return {
          level: share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
          folderName: folder.name,
        }
      }
    }

    // Check allPermissionLevel
    if (
      folder.allPermissionLevel !== null &&
      folder.allPermissionLevel !== undefined
    ) {
      return {
        level: folder.allPermissionLevel,
        folderName: folder.name,
      }
    }

    currentParentId = folder.parentId ?? null
  }
  return { level: null, folderName: null }
}

async function getSidebarItemShareForMember(
  ctx: CampaignQueryCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: SidebarItemId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<SidebarItemShare | null> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
}
