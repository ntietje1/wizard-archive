import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { enhanceSidebarItem } from '../../sidebarItems/functions/enhanceSidebarItem'
import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Folder } from '../types'

export async function getSidebarItemAncestors(
  ctx: AuthQueryCtx,
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
    await requireCampaignMembership(ctx, item.campaignId)
    if (isTrashed && item.location !== SIDEBAR_ITEM_LOCATION.trash) {
      break
    }
    const folder = await enhanceSidebarItem(ctx, { item })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
