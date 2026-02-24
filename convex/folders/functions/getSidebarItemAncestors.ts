import { enhanceSidebarItem } from '../../sidebarItems/functions/enhanceSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Folder } from '../types'

export async function getSidebarItemAncestors(
  ctx: CampaignQueryCtx,
  { initialParentId }: { initialParentId: Id<'folders'> | undefined },
): Promise<Array<Folder>> {
  const ancestors: Array<Folder> = []
  let currentParentId = initialParentId

  const visited = new Set<Id<'folders'>>()
  while (currentParentId) {
    if (visited.has(currentParentId)) {
      break
    }
    visited.add(currentParentId)
    const rawFolder = await ctx.db.get(currentParentId)
    if (!rawFolder) {
      break
    }
    const folder = await enhanceSidebarItem(ctx, { item: rawFolder })

    ancestors.unshift(folder)
    currentParentId = folder.parentId
  }

  return ancestors
}
