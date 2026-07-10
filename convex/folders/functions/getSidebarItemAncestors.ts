import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { isTrashedSidebarItem } from '../../sidebarItems/types/status'
import { canAccessResourceAndAncestors } from '../../sidebarItems/functions/resourceAccessPolicy'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { FolderResource } from '@wizard-archive/editor/resources/resource-contract'

export async function getSidebarItemAncestors(
  ctx: CampaignQueryCtx,
  {
    initialParentId,
    isTrashed,
  }: { initialParentId: Id<'sidebarItems'> | null; isTrashed?: boolean },
): Promise<Array<FolderResource>> {
  const ancestors: Array<FolderResource> = []
  let currentParentId: Id<'sidebarItems'> | null = initialParentId

  const visited = new Set<Id<'sidebarItems'>>()
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break
    }
    visited.add(currentParentId)
    const rawItem = await ctx.db.get('sidebarItems', currentParentId)
    if (
      !rawItem ||
      rawItem.type !== RESOURCE_TYPES.folders ||
      (isTrashed ?? false) !== isTrashedSidebarItem(rawItem) ||
      !(await canAccessResourceAndAncestors(ctx, rawItem, PERMISSION_LEVEL.VIEW))
    ) {
      break
    }
    const item = await getSidebarItem(ctx, currentParentId)
    if (!item || item.type !== RESOURCE_TYPES.folders) break
    const folder = await enhanceBase(ctx, { item })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
