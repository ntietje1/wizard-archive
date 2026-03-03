import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { getSidebarItemSharesForItem } from './getSidebarItemSharesForItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
} from '../../sidebarItems/types/types'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../types'

/**
 * Walk the ancestor folder chain once and resolve inherited permissions
 * for all provided members + the "all players" level.
 *
 * Used by both:
 * - getSidebarItemWithShares (UI query, N members)
 * - getSidebarItemPermissionLevel (access control, 1 member)
 */
export async function resolveAllInheritedPermissions(
  ctx: CampaignQueryCtx,
  {
    parentId,
    memberIds,
  }: {
    parentId: Id<'folders'> | null
    memberIds: Array<Id<'campaignMembers'>>
  },
): Promise<{
  allPlayers: { level: PermissionLevel | null; folderName: string | null }
  members: Record<
    Id<'campaignMembers'>,
    { level: PermissionLevel; folderName: string | null }
  >
}> {
  const result: {
    allPlayers: { level: PermissionLevel | null; folderName: string | null }
    members: Record<
      Id<'campaignMembers'>,
      { level: PermissionLevel; folderName: string | null }
    >
  } = {
    allPlayers: { level: null, folderName: null },
    members: {} as Record<
      Id<'campaignMembers'>,
      { level: PermissionLevel; folderName: string | null }
    >,
  }

  // Track which members still need resolution
  const unresolvedMembers = new Set(memberIds)
  let allPlayersResolved = false

  let currentParentId = parentId
  while (currentParentId) {
    const folder = await ctx.db.get(currentParentId)
    if (!folder) break

    if (!folder.inheritShares) {
      currentParentId = folder.parentId
      continue
    }

    // Batch-fetch all shares for this folder in one index query
    if (unresolvedMembers.size > 0) {
      const shares = await getSidebarItemSharesForItem(ctx, {
        sidebarItemId: currentParentId,
      })

      for (const share of shares) {
        if (unresolvedMembers.has(share.campaignMemberId)) {
          result.members[share.campaignMemberId] = {
            level: share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
            folderName: folder.name,
          }
          unresolvedMembers.delete(share.campaignMemberId)
        }
      }
    }

    // Check allPermissionLevel — resolves "all players" and any remaining unresolved members
    if (
      folder.allPermissionLevel !== null &&
      folder.allPermissionLevel !== undefined
    ) {
      if (!allPlayersResolved) {
        result.allPlayers = {
          level: folder.allPermissionLevel,
          folderName: folder.name,
        }
        allPlayersResolved = true
      }

      // All remaining unresolved members inherit this level
      for (const memberId of unresolvedMembers) {
        result.members[memberId] = {
          level: folder.allPermissionLevel,
          folderName: folder.name,
        }
      }
      unresolvedMembers.clear()
    }

    // If everything is resolved, stop walking
    if (allPlayersResolved && unresolvedMembers.size === 0) break

    currentParentId = folder.parentId ?? null
  }

  // Fill in unresolved members with NONE
  for (const memberId of unresolvedMembers) {
    result.members[memberId] = {
      level: PERMISSION_LEVEL.NONE,
      folderName: null,
    }
  }

  return result
}

export async function getSidebarItemPermissionLevel(
  ctx: CampaignQueryCtx,
  { item }: { item: AnySidebarItem | AnySidebarItemFromDb },
): Promise<PermissionLevel> {
  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.FULL_ACCESS
  }

  const checkId = ctx.membership._id

  // Check for an explicit per-player share on the item itself
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
  const inherited = await resolveAllInheritedPermissions(ctx, {
    parentId: item.parentId ?? null,
    memberIds: [checkId],
  })
  return inherited.members[checkId]?.level ?? PERMISSION_LEVEL.NONE
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
