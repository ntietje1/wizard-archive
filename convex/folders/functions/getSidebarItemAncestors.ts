import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { isTrashedSidebarItem } from '../../sidebarItems/types/status'
import { canAccessResourceAndAncestors } from '../../sidebarItems/functions/resourceAccessPolicy'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { FolderResource } from '@wizard-archive/editor/resources/resource-contract'
import { findSidebarItemRow } from '../../sidebarItems/functions/sidebarItemIdentity'

export async function getSidebarItemAncestors(
  ctx: CampaignQueryCtx,
  { initialParentId, isTrashed }: { initialParentId: ResourceId | null; isTrashed?: boolean },
): Promise<Array<FolderResource>> {
  const ancestors: Array<FolderResource> = []
  let currentParentId: ResourceId | null = initialParentId

  const visited = new Set<ResourceId>()
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break
    }
    visited.add(currentParentId)
    const rawItem = await findSidebarItemRow(ctx, currentParentId)
    if (
      !rawItem ||
      rawItem.type !== RESOURCE_TYPES.folders ||
      (isTrashed ?? false) !== isTrashedSidebarItem(rawItem) ||
      !(await canAccessResourceAndAncestors(ctx, rawItem, PERMISSION_LEVEL.VIEW))
    ) {
      break
    }
    const item = await getSidebarItem(ctx, rawItem._id)
    if (!item || item.type !== RESOURCE_TYPES.folders) break
    const folder = await enhanceBase(ctx, { item })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
