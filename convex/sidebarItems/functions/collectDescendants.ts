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
    folderId: Id<'folders'>
  },
): Promise<Array<AnySidebarItemFromDb>> {
  const result: Array<AnySidebarItemFromDb> = []

  async function collectFromFolder(parentId: Id<'folders'>) {
    const [childFolders, childNotes, childMaps, childFiles] = await Promise.all([
      ctx.db
        .query('folders')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
        )
        .collect(),
      ctx.db
        .query('notes')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
        )
        .collect(),
      ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
        )
        .collect(),
      ctx.db
        .query('files')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location).eq('parentId', parentId),
        )
        .collect(),
    ])

    result.push(
      ...(childNotes as Array<AnySidebarItemFromDb>),
      ...(childMaps as Array<AnySidebarItemFromDb>),
      ...(childFiles as Array<AnySidebarItemFromDb>),
    )

    for (const folder of childFolders) {
      result.push(folder as AnySidebarItemFromDb)
      await collectFromFolder(folder._id)
    }
  }

  await collectFromFolder(folderId)
  return result
}
