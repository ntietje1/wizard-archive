import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { Ctx } from '../common/types'
import { type GameMap } from './types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { MutationCtx } from '../_generated/server'

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

  return map
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

  return map
}

export const deleteMap = async (
  ctx: MutationCtx,
  mapId: Id<'gameMaps'>,
): Promise<Id<'gameMaps'>> => {
  const map = await ctx.db.get(mapId)
  if (!map) {
    throw new Error('Map not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: map.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const pins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()

  for (const pin of pins) {
    await ctx.db.delete(pin._id)
  }

  await ctx.db.delete(mapId)
  return mapId
}
