import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import { isTrashedSidebarItem } from '../../sidebarItems/types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Folder } from '../types'

export async function getSidebarItemAncestors(
  ctx: CampaignQueryCtx,
  {
    initialParentId,
    isTrashed,
  }: { initialParentId: Id<'sidebarItems'> | null; isTrashed?: boolean },
): Promise<Array<Folder>> {
  const ancestors: Array<Folder> = []
  let currentParentId: Id<'sidebarItems'> | null = initialParentId

  const visited = new Set<Id<'sidebarItems'>>()
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break
    }
    visited.add(currentParentId)
    const item = await getSidebarItem(ctx, currentParentId)
    if (!item || item.type !== SIDEBAR_ITEM_TYPES.folders) {
      break
    }
    if ((isTrashed ?? false) !== isTrashedSidebarItem(item)) {
      break
    }
    const folder = await enhanceBase(ctx, { item })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
