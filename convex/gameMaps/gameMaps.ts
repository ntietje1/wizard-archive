import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { enhanceGameMapWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { GameMap, GameMapWithContent } from './types'

export const getMap = async (
  ctx: Ctx,
  mapId: Id<'gameMaps'>,
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get(mapId)
  if (!rawMap) {
    return null
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: rawMap.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const map = (await enhanceSidebarItem(ctx, rawMap)) as GameMap

  return enhanceGameMapWithContent(ctx, map)
}

export const getMapBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<GameMapWithContent | null> => {
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

  return getMap(ctx, map._id)
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
