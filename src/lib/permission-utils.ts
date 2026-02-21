import { PERMISSION_LEVEL } from 'convex/shares/types'
import type { PermissionLevel } from 'convex/shares/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
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

  if (item.allPermissionLevel !== undefined) {
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

    if (folder.allPermissionLevel !== undefined) {
      return { level: folder.allPermissionLevel, source: folder.name }
    }

    currentParentId = folder.parentId
  }

  return { level: PERMISSION_LEVEL.NONE }
}
