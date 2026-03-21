import { requireCampaignMembership } from '../../functions'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { AnySidebarItem } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getSidebarItemByName = async (
  ctx: AuthQueryCtx,
  { name, campaignId }: { name: string; campaignId: Id<'campaigns'> },
): Promise<AnySidebarItem | null> => {
  await requireCampaignMembership(ctx, campaignId)

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
