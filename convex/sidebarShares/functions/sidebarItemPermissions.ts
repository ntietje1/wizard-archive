import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { SharesMap } from './getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  AnySidebarItem,
  AnySidebarItemFromDb,
} from '../../sidebarItems/types/types'
import type { PermissionLevel } from '../../permissions/types'

/**
 * Walk the ancestor folder chain once and resolve inherited permissions
 * for all provided members + the "all players" level.
 *
 * When sharesMap is provided, uses in-memory lookups (batch path).
 * When omitted, queries shares per-folder (single-item path).
 */
export async function resolveInheritedPermissions(
  ctx: AuthQueryCtx,
  {
    parentId,
    campaignId,
    memberIds,
    sharesMap,
  }: {
    parentId: Id<'folders'> | null
    campaignId: Id<'campaigns'>
    memberIds: Array<Id<'campaignMembers'>>
    sharesMap?: SharesMap
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

    if (unresolvedMembers.size > 0) {
      if (sharesMap) {
        const folderShares = sharesMap.get(currentParentId)
        if (folderShares) {
          for (const memberId of unresolvedMembers) {
            const share = folderShares.get(memberId)
            if (share) {
              result.members[memberId] = {
                level: share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
                folderName: folder.name,
              }
              unresolvedMembers.delete(memberId)
            }
          }
        }
      } else {
        const folderShares = await ctx.db
          .query('sidebarItemShares')
          .withIndex('by_campaign_item_member', (q) =>
            q
              .eq('campaignId', campaignId)
              .eq('sidebarItemId', currentParentId!),
          )
          .collect()
        for (const share of folderShares) {
          if (unresolvedMembers.has(share.campaignMemberId)) {
            result.members[share.campaignMemberId] = {
              level: share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
              folderName: folder.name,
            }
            unresolvedMembers.delete(share.campaignMemberId)
          }
        }
      }
    }

    if (folder.allPermissionLevel !== null) {
      if (!allPlayersResolved) {
        result.allPlayers = {
          level: folder.allPermissionLevel,
          folderName: folder.name,
        }
        allPlayersResolved = true
      }

      for (const memberId of unresolvedMembers) {
        result.members[memberId] = {
          level: folder.allPermissionLevel,
          folderName: folder.name,
        }
      }
      unresolvedMembers.clear()
    }

    if (allPlayersResolved && unresolvedMembers.size === 0) break

    currentParentId = folder.parentId ?? null
  }

  for (const memberId of unresolvedMembers) {
    result.members[memberId] = {
      level: PERMISSION_LEVEL.NONE,
      folderName: null,
    }
  }

  return result
}

export async function getSidebarItemPermissionLevel(
  ctx: AuthQueryCtx,
  {
    item,
    sharesMap,
  }: {
    item: AnySidebarItem | AnySidebarItemFromDb
    sharesMap?: SharesMap
  },
): Promise<PermissionLevel> {
  const campaignId = item.campaignId
  const { membership } = await requireCampaignMembership(ctx, campaignId)

  if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.FULL_ACCESS
  }

  const checkId = membership._id

  if (sharesMap) {
    // Batch path: use pre-loaded shares map
    const share = sharesMap.get(item._id)?.get(checkId)
    if (share) return share.permissionLevel ?? PERMISSION_LEVEL.VIEW

    if (item.allPermissionLevel !== null) return item.allPermissionLevel

    const inherited = await resolveInheritedPermissions(ctx, {
      parentId: item.parentId ?? null,
      campaignId,
      memberIds: [checkId],
      sharesMap,
    })
    return inherited.members[checkId]?.level ?? PERMISSION_LEVEL.NONE
  }

  // Single-item path: direct queries
  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', item._id)
        .eq('campaignMemberId', checkId),
    )
    .unique()
  if (share) return share.permissionLevel ?? PERMISSION_LEVEL.VIEW

  if (item.allPermissionLevel !== null) return item.allPermissionLevel

  const inherited = await resolveInheritedPermissions(ctx, {
    parentId: item.parentId ?? null,
    campaignId,
    memberIds: [checkId],
  })
  return inherited.members[checkId]?.level ?? PERMISSION_LEVEL.NONE
}
