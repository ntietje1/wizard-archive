import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { AnySidebarItem, AnySidebarItemFromDb } from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

/**
 * Returns all trashed sidebar items in the campaign, sorted by deletionTime desc.
 */
export const getTrashedSidebarItems = async (
  ctx: CampaignQueryCtx,
): Promise<Array<AnySidebarItem>> => {
  const campaignId = ctx.campaign._id

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
  ])

  const allItems: Array<AnySidebarItemFromDb> = [
    ...folders,
    ...notes,
    ...maps,
    ...files,
  ]

  // Sort by deletionTime descending (most recently trashed first)
  allItems.sort((a, b) => (b.deletionTime ?? 0) - (a.deletionTime ?? 0))

  return await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, { item })),
  )
}
