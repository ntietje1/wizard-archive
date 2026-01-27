import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { pipe } from '../common/pipeline'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { enhanceGameMapWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { GameMapWithContent } from './types'

export const getMap = async (
  ctx: Ctx,
  mapId: Id<'gameMaps'>,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get(mapId)

  return pipe(ctx, rawMap)
    .pipe(enhanceSidebarItem)
    .pipe((ctx, map) => enhanceGameMapWithContent(ctx, map, viewAsPlayerId))
    .run()
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
