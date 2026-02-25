import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { getSidebarItemById } from './getSidebarItemById'
import type {
  AnySidebarItemFromDb,
  AnySidebarItemWithContent,
} from '../types/types'
import type { SidebarItemType } from '../types/baseTypes'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemBySlug = async (
  ctx: CampaignQueryCtx,
  { type, slug }: { type: SidebarItemType; slug: string },
): Promise<AnySidebarItemWithContent | null> => {
  const campaignId = ctx.campaign._id
  let item: AnySidebarItemFromDb | null = null

  switch (type) {
    case SIDEBAR_ITEM_TYPES.folders:
      item = await ctx.db
        .query('folders')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.notes:
      item = await ctx.db
        .query('notes')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      item = await ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    case SIDEBAR_ITEM_TYPES.files:
      item = await ctx.db
        .query('files')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', campaignId).eq('slug', slug),
        )
        .unique()
      break
    default:
      throw new Error(`Unknown item type, ${type}`)
  }

  if (!item) {
    return null
  }

  return await getSidebarItemById(ctx, { id: item._id })
}
