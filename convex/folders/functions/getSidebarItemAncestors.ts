import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { enhanceSidebarItem } from '../../sidebarItems/functions/enhanceSidebarItem'
import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Folder } from '../types'

export async function getSidebarItemAncestors(
  ctx: AuthQueryCtx,
  { initialParentId, isTrashed }: { initialParentId: Id<'folders'> | null; isTrashed?: boolean },
): Promise<Array<Folder>> {
  const ancestors: Array<Folder> = []
  let currentParentId: Id<'folders'> | null = initialParentId

  const visited = new Set<Id<'folders'>>()
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break
    }
    visited.add(currentParentId)
    const rawFolder = await ctx.db.get("folders", currentParentId)
    if (!rawFolder) {
      break
    }
    await requireCampaignMembership(ctx, rawFolder.campaignId)
    // Trashed items only show trashed ancestors
    if (isTrashed && rawFolder.location !== SIDEBAR_ITEM_LOCATION.trash) {
      break
    }
    const folder = await enhanceSidebarItem(ctx, { item: rawFolder })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
