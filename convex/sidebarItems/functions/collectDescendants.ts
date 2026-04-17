import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AnySidebarItemRow } from '../types/types'

export async function collectDescendants(
  ctx: QueryCtx | MutationCtx,
  {
    campaignId,
    location,
    folderId,
  }: {
    campaignId: Id<'campaigns'>
    location: SidebarItemLocation
    folderId: Id<'sidebarItems'>
  },
): Promise<Array<AnySidebarItemRow>> {
  const result: Array<AnySidebarItemRow> = []

  async function collectFromFolder(parentId: Id<'sidebarItems'>) {
    const children: Array<AnySidebarItemRow> = await ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
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
