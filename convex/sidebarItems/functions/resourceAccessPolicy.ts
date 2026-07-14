import { asyncMap } from 'convex-helpers'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { getSidebarItemPermissionLevelForMembership } from '../../sidebarShares/functions/sidebarItemPermissions'
import { isActiveSidebarItem, isUndoHiddenSidebarItem } from '../types/status'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

export type ResourceAccessPolicyCtx = Pick<QueryCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
  membership: CampaignMemberRow
}

export type AccessibleResourceRow = {
  rawItem: Doc<'sidebarItems'>
  myPermissionLevel: PermissionLevel
}

type PermissionCache = Map<Doc<'sidebarItems'>['_id'], Promise<PermissionLevel>>

export async function canAccessResourceAndAncestors(
  ctx: ResourceAccessPolicyCtx,
  rawItem: Doc<'sidebarItems'>,
  requiredLevel: PermissionLevel,
  permissionCache: PermissionCache = new Map(),
): Promise<boolean> {
  const targetIsActive = isActiveSidebarItem(rawItem)
  let current: Doc<'sidebarItems'> | null = rawItem
  const seen = new Set<Doc<'sidebarItems'>['_id']>()

  while (current) {
    if (
      seen.has(current._id) ||
      current.campaignId !== ctx.campaign._id ||
      isUndoHiddenSidebarItem(current) ||
      (targetIsActive && !isActiveSidebarItem(current))
    ) {
      return false
    }
    seen.add(current._id)

    const permissionLevel = await getCachedResourcePermissionLevel(ctx, current, permissionCache)
    if (!hasAtLeastPermissionLevel(permissionLevel, requiredLevel)) return false
    if (!current.parentId) return true

    current = await ctx.db.get('sidebarItems', current.parentId)
  }

  return false
}

export async function resolveResourceRowsByAccess(
  ctx: ResourceAccessPolicyCtx,
  rawItems: Array<Doc<'sidebarItems'>>,
  requiredLevel: PermissionLevel,
): Promise<Array<AccessibleResourceRow>> {
  const permissionCache: PermissionCache = new Map()
  return (
    await asyncMap(rawItems, async (rawItem) => {
      if (!(await canAccessResourceAndAncestors(ctx, rawItem, requiredLevel, permissionCache))) {
        return null
      }
      return {
        rawItem,
        myPermissionLevel: await getCachedResourcePermissionLevel(ctx, rawItem, permissionCache),
      }
    })
  ).filter((row): row is AccessibleResourceRow => row !== null)
}

async function getCachedResourcePermissionLevel(
  ctx: ResourceAccessPolicyCtx,
  item: Doc<'sidebarItems'>,
  permissionCache: PermissionCache,
): Promise<PermissionLevel> {
  const cached = permissionCache.get(item._id)
  if (cached !== undefined) return cached

  const permissionLevel = getSidebarItemPermissionLevelForMembership(ctx, {
    item: {
      id: item._id,
      allPermissionLevel: item.allPermissionLevel,
      parentId: item.parentId,
    },
    membership: ctx.membership,
  })
  permissionCache.set(item._id, permissionLevel)
  return await permissionLevel
}
