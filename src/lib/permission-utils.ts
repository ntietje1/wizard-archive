import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import type { PermissionLevel } from 'convex/shares/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'

/**
 * Client-side permission resolution mirroring server logic.
 * Walks the item's shares and parent chain to determine effective permission.
 */
export function resolvePermissionLevel(
  item: AnySidebarItem,
  memberId: Id<'campaignMembers'>,
  allItemsMap: Map<SidebarItemId, AnySidebarItem>,
): { level: PermissionLevel; source?: string } {
  const memberShare = item.shares.find((s) => s.campaignMemberId === memberId)
  if (memberShare) {
    return { level: memberShare.permissionLevel ?? PERMISSION_LEVEL.VIEW }
  }

  if (item.allPermissionLevel !== null && item.allPermissionLevel !== undefined) {
    return { level: item.allPermissionLevel }
  }

  let currentParentId = item.parentId
  const seen = new Set<string>()

  while (currentParentId) {
    if (seen.has(currentParentId)) break
    seen.add(currentParentId)

    const folder = allItemsMap.get(currentParentId) as Folder
    if (!folder) break

    if (!folder.inheritShares) {
      currentParentId = folder.parentId
      continue
    }

    if (memberId) {
      const folderShare = folder.shares.find(
        (s) => s.campaignMemberId === memberId,
      )
      if (folderShare) {
        return {
          level: folderShare.permissionLevel ?? PERMISSION_LEVEL.VIEW,
          source: folder.name,
        }
      }
    }

    if (folder.allPermissionLevel !== null && folder.allPermissionLevel !== undefined) {
      return { level: folder.allPermissionLevel, source: folder.name }
    }

    currentParentId = folder.parentId
  }

  return { level: PERMISSION_LEVEL.NONE }
}

/**
 * Check whether a specific campaign member has at least the required
 * permission level on an item, using client-side share/hierarchy data.
 */
export function memberHasAtLeastPermission(
  item: AnySidebarItem,
  memberId: Id<'campaignMembers'>,
  allItemsMap: Map<SidebarItemId, AnySidebarItem>,
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
    viewAsPlayerId: Id<'campaignMembers'> | null | undefined
    allItemsMap: Map<SidebarItemId, AnySidebarItem>
  },
): boolean {
  if (opts.isDm && !opts.viewAsPlayerId) return true
  if (opts.isDm && opts.viewAsPlayerId) {
    return memberHasAtLeastPermission(
      item,
      opts.viewAsPlayerId,
      opts.allItemsMap,
      requiredLevel,
    )
  }
  return hasAtLeastPermissionLevel(item.myPermissionLevel, requiredLevel)
}
