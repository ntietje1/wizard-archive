import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItem } from './getSidebarItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { AnySidebarItemFromDb } from '../types/types'

export async function collectDescendants(
  ctx: QueryCtx,
  {
    campaignId,
    location,
    folderId,
  }: {
    campaignId: Id<'campaigns'>
    location: SidebarItemLocation
    folderId: Id<'sidebarItems'>
  },
): Promise<Array<AnySidebarItemFromDb>> {
  const result: Array<AnySidebarItemFromDb> = []

  async function collectFromFolder(parentId: Id<'sidebarItems'>) {
    const children = await ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
      )
      .collect()

    const childFolders = children.filter((c) => c.type === SIDEBAR_ITEM_TYPES.folders)
    const nonFolders = children.filter((c) => c.type !== SIDEBAR_ITEM_TYPES.folders)

    const enhanced = await Promise.all(nonFolders.map((raw) => getSidebarItem(ctx, raw._id)))
    for (const item of enhanced) {
      if (item) result.push(item)
    }

    for (const folder of childFolders) {
      const enhancedFolder = await getSidebarItem(ctx, folder._id)
      if (enhancedFolder) result.push(enhancedFolder)
      await collectFromFolder(folder._id)
    }
  }

  await collectFromFolder(folderId)
  return result
}
