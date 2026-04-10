import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getFolder } from '../../sidebarItems/functions/loadExtensionData'
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
    const folderFromDb = await getFolder(ctx, currentParentId)
    if (!folderFromDb) {
      break
    }
    await requireCampaignMembership(ctx, folderFromDb.campaignId)
    if (isTrashed && folderFromDb.location !== SIDEBAR_ITEM_LOCATION.trash) {
      break
    }
    const folder = await enhanceSidebarItem(ctx, { item: folderFromDb })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
