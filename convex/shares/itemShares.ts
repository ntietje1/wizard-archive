import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getCurrentSession } from '../sessions/sessions'
import { defaultItemName } from '../sidebarItems/sidebarItems'
import { PERMISSION_LEVEL, PERMISSION_RANK } from './types'
import type { CampaignQueryCtx } from '../functions'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
} from '../sidebarItems/types'
import type { SidebarItemId, SidebarItemType } from '../sidebarItems/baseTypes'
import type { PermissionLevel, SidebarItemShare } from './types'

export async function getSidebarItemPermissionLevel(
  ctx: CampaignQueryCtx,
  item: AnySidebarItem | AnySidebarItemFromDb,
): Promise<PermissionLevel> {
  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.FULL_ACCESS
  }

  const checkId = ctx.membership._id

  // Check for an explicit per-player share
  const share = await getSidebarItemShareForMember(
    ctx,
    item.campaignId,
    item._id,
    checkId,
  )
  if (share) {
    return share.permissionLevel ?? PERMISSION_LEVEL.VIEW
  }

  // Check item's own explicit allPermissionLevel
  const allPerm = item.allPermissionLevel
  if (allPerm !== undefined) {
    return allPerm
  }

  // Walk up folder hierarchy for inherited permission
  const parentId = item.parentId
  return await resolveInheritedPermission(
    ctx,
    item.campaignId,
    parentId,
    checkId,
  )
}

async function resolveInheritedPermission(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  playerId: Id<'campaignMembers'>,
): Promise<PermissionLevel> {
  const { level } = await resolveInheritedPermissionWithSource(
    ctx,
    campaignId,
    parentId,
    playerId,
  )
  return level ?? PERMISSION_LEVEL.NONE
}

export async function resolveInheritedPermissionWithSource(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  parentId: Id<'folders'> | undefined,
  memberId?: Id<'campaignMembers'>,
): Promise<{ level: PermissionLevel | undefined; folderName?: string }> {
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
      const share = await getSidebarItemShareForMember(
        ctx,
        campaignId,
        currentParentId,
        memberId,
      )
      if (share) {
        return {
          level: share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
          folderName: folder.name || defaultItemName(folder),
        }
      }
    }

    // Check allPermissionLevel
    if (folder.allPermissionLevel !== undefined) {
      return {
        level: folder.allPermissionLevel,
        folderName: folder.name || defaultItemName(folder),
      }
    }

    currentParentId = folder.parentId
  }
  return { level: undefined }
}

export function hasAtLeastPermissionLevel(
  level: PermissionLevel,
  requiredLevel: PermissionLevel,
): boolean {
  return PERMISSION_RANK[level] >= PERMISSION_RANK[requiredLevel]
}

export async function shareSidebarItemWithMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  sidebarItemType: SidebarItemType,
  campaignMemberId: Id<'campaignMembers'>,
  permissionLevel?: PermissionLevel,
): Promise<Id<'sidebarItemShares'>> {
  // Check if share already exists
  const existingShare = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (existingShare) {
    // Update permission level if provided and different
    if (
      permissionLevel !== undefined &&
      existingShare.permissionLevel !== permissionLevel
    ) {
      await ctx.db.patch(existingShare._id, { permissionLevel })
    }
    return existingShare._id
  }

  // Get current session if any
  const currentSession = await getCurrentSession(ctx, campaignId)

  return await ctx.db.insert('sidebarItemShares', {
    campaignId,
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    sessionId: currentSession?._id,
    permissionLevel,
  })
}

export async function unshareSidebarItemFromMember(
  ctx: MutationCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<void> {
  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete(share._id)
  }
}

export async function getSidebarItemSharesForItem(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
): Promise<Array<SidebarItemShare>> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()
}

export async function getSidebarItemSharesForMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Array<SidebarItemShare>> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_member', (q) =>
      q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId),
    )
    .collect()
}

export async function getSidebarItemShareForMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<SidebarItemShare | null> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
}

export async function isSidebarItemSharedWithMember(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
  sidebarItemId: SidebarItemId,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<boolean> {
  const share = await getSidebarItemShareForMember(
    ctx,
    campaignId,
    sidebarItemId,
    campaignMemberId,
  )
  return share !== null
}
