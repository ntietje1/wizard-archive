import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { Ctx } from '../common/types'
import { type GameMap } from './types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const getMap = async (
  ctx: Ctx,
  mapId: Id<'gameMaps'>,
): Promise<GameMap> => {
  const map = await ctx.db.get(mapId)
  if (!map) {
    throw new Error('Map not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: map.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  return {
    ...map,
    type: SIDEBAR_ITEM_TYPES.gameMaps,
  }
}

export const getMapBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<GameMap | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const map = await ctx.db
    .query('gameMaps')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  if (!map) {
    return null
  }

  return {
    ...map,
    type: SIDEBAR_ITEM_TYPES.gameMaps,
  }
}
