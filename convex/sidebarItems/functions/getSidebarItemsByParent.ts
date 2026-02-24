import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { AnySidebarItem, AnySidebarItemFromDb } from '../types/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemsByParent = async (
  ctx: CampaignQueryCtx,
  { parentId }: { parentId: Id<'folders'> | undefined },
): Promise<Array<AnySidebarItem>> => {
  const campaignId = ctx.campaign._id

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('parentId', parentId),
      )
      .collect(),
  ])

  const allItems: Array<AnySidebarItemFromDb> = [
    ...folders,
    ...notes,
    ...maps,
    ...files,
  ]

  return await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, { item })),
  )
}
