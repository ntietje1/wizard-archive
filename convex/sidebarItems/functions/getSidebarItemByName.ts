import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { AnySidebarItem } from '../types/types'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemByName = async (
  ctx: CampaignQueryCtx,
  { name }: { name: string },
): Promise<AnySidebarItem | null> => {
  const campaignId = ctx.campaign._id

  const [note, folder, map, file] = await Promise.all([
    ctx.db
      .query('notes')
      .withIndex('by_campaign_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('deletionTime', undefined)
          .eq('name', name),
      )
      .unique(),
    ctx.db
      .query('folders')
      .withIndex('by_campaign_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('deletionTime', undefined)
          .eq('name', name),
      )
      .unique(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('deletionTime', undefined)
          .eq('name', name),
      )
      .unique(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('deletionTime', undefined)
          .eq('name', name),
      )
      .unique(),
  ])

  const item = note ?? folder ?? map ?? file
  if (!item) {
    return null
  }

  return await enhanceSidebarItem(ctx, { item })
}
