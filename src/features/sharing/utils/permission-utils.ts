import { hasAtLeastPermissionLevel } from 'shared/permissions/hasAtLeastPermissionLevel'
import { normalizeExplicitSharePermissionLevel } from 'shared/permissions/share-permissions'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { CampaignMember } from 'shared/campaigns/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'shared/folders/types'

type CampaignMemberId = CampaignMember['_id']

function getMemberPermission(
  item: AnySidebarItem | Folder,
  memberId: CampaignMemberId,
): PermissionLevel | null {
  const memberShare = item.shares.find((s) => s.campaignMemberId === memberId)
  return memberShare ? normalizeExplicitSharePermissionLevel(memberShare.permissionLevel) : null
}

function getAllPlayersPermission(item: AnySidebarItem | Folder): PermissionLevel | null {
  return item.allPermissionLevel ?? null
}

function resolveInheritedPermission(
  item: AnySidebarItem,
  memberId: CampaignMemberId,
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): { level: PermissionLevel; source: string } | null {
  let currentParentId = item.parentId
  const seen = new Set<Id<'sidebarItems'>>()

  while (currentParentId) {
    if (seen.has(currentParentId)) return null
    seen.add(currentParentId)

    const folder = allItemsMap.get(currentParentId) as Folder | undefined
    if (!folder) return null
    currentParentId = folder.parentId

    const memberPermission = getMemberPermission(folder, memberId)
    if (memberPermission !== null) return { level: memberPermission, source: folder.name }

    const allPlayersPermission = getAllPlayersPermission(folder)
    if (allPlayersPermission !== null) {
      return { level: allPlayersPermission, source: folder.name }
    }
  }

  return null
}

/**
 * Client-side permission resolution mirroring server logic.
 * Walks the item's shares and parent chain to determine effective permission.
 */
function resolvePermissionLevel(
  item: AnySidebarItem,
  memberId: CampaignMemberId,
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): { level: PermissionLevel; source?: string } {
  const memberPermission = getMemberPermission(item, memberId)
  if (memberPermission !== null) return { level: memberPermission }

  const allPlayersPermission = getAllPlayersPermission(item)
  if (allPlayersPermission !== null) return { level: allPlayersPermission }

  return resolveInheritedPermission(item, memberId, allItemsMap) ?? { level: PERMISSION_LEVEL.NONE }
}

/**
 * Check whether a specific campaign member has at least the required
 * permission level on an item, using client-side share/hierarchy data.
 */
function memberHasAtLeastPermission(
  item: AnySidebarItem,
  memberId: CampaignMemberId,
  allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  requiredLevel: PermissionLevel,
): boolean {
  const { level } = resolvePermissionLevel(item, memberId, allItemsMap)
  return hasAtLeastPermissionLevel(level, requiredLevel)
}

/**
 * Unified permission check that handles DM / view-as / player branching.
 * - DM without view-as: always has permission
 * - DM with view-as: checks viewed player's resolved permission
 * - Regular player: checks their own myPermissionLevel from the backend
 */
export function effectiveHasAtLeastPermission(
  item: AnySidebarItem,
  requiredLevel: PermissionLevel,
  opts: {
    isDm: boolean | undefined
    viewAsPlayerId: CampaignMemberId | null | undefined
    allItemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  },
): boolean {
  if (opts.isDm && !opts.viewAsPlayerId) return true
  if (opts.isDm && opts.viewAsPlayerId) {
    return memberHasAtLeastPermission(item, opts.viewAsPlayerId, opts.allItemsMap, requiredLevel)
  }
  return hasAtLeastPermissionLevel(item.myPermissionLevel, requiredLevel)
}
