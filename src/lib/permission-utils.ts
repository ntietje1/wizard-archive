import {
  ATLEAST_PERMISSION_LEVEL,
  PERMISSION_LEVEL,
} from 'convex/shares/types'
import type { PermissionLevel } from 'convex/shares/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'

export function hasAtLeastPermissionLevel(
  level: PermissionLevel,
  requiredLevel: PermissionLevel,
): boolean {
  return ATLEAST_PERMISSION_LEVEL[requiredLevel].includes(level)
}

/**
 * Client-side permission resolution mirroring server logic.
 * Walks the item's shares and parent chain to determine effective permission.
 */
export function resolvePermissionLevel(
  item: AnySidebarItem,
  memberId: Id<'campaignMembers'>,
  allItemsMap: Map<SidebarItemId, AnySidebarItem>,
): PermissionLevel {
  // Check item's own explicit per-member share
  const memberShare = item.shares.find(
    (s) => s.campaignMemberId === memberId,
  )
  if (memberShare) {
    return memberShare.permissionLevel ?? PERMISSION_LEVEL.VIEW
  }

  // Check item's own allPermissionLevel
  if (item.allPermissionLevel !== undefined) {
    return item.allPermissionLevel
  }

  // Walk up parent folder hierarchy for inherited permission
  let currentParentId = item.parentId
  const seen = new Set<string>()

  while (currentParentId) {
    if (seen.has(currentParentId)) break
    seen.add(currentParentId)

    const parent = allItemsMap.get(currentParentId)
    if (!parent) break

    // Only folders with inheritShares propagate permissions
    const folder = parent as Folder
    if (!folder.inheritShares) {
      currentParentId = folder.parentId
      continue
    }

    // Check folder's per-member share
    const folderShare = folder.shares.find(
      (s) => s.campaignMemberId === memberId,
    )
    if (folderShare) {
      return folderShare.permissionLevel ?? PERMISSION_LEVEL.VIEW
    }

    // Check folder's allPermissionLevel
    if (folder.allPermissionLevel !== undefined) {
      return folder.allPermissionLevel
    }

    currentParentId = folder.parentId
  }

  return PERMISSION_LEVEL.NONE
}
