import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemStatus } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'

export async function collectDescendants(
  ctx: QueryCtx | MutationCtx,
  {
    campaignId,
    status,
    folderId,
  }: {
    campaignId: Id<'campaigns'>
    status: SidebarItemStatus
    folderId: Id<'sidebarItems'>
  },
): Promise<Array<AnySidebarItemRow>> {
  const result: Array<AnySidebarItemRow> = []

  async function collectFromFolder(parentId: Id<'sidebarItems'>) {
    const children = await ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
        q.eq('campaignId', campaignId).eq('status', status).eq('parentId', parentId),
      )
      .collect()

    const childFolders = children.filter((c) => c.type === SIDEBAR_ITEM_TYPES.folders)
    const nonFolders = children.filter((c) => c.type !== SIDEBAR_ITEM_TYPES.folders)

    result.push(...nonFolders)

    for (const folder of childFolders) {
      result.push(folder)
      await collectFromFolder(folder._id)
    }
  }

  await collectFromFolder(folderId)
  return result
}
