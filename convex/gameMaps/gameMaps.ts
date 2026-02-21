import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  hasViewPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { enhanceGameMapWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { GameMapFromDb, GameMapWithContent } from './types'

export const getMap = async (
  ctx: Ctx,
  mapId: Id<'gameMaps'>,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get(mapId)
  if (!rawMap) return null

  const map = await enhanceSidebarItem(ctx, rawMap)
  const hasPermission = await hasViewPermission(ctx, map)
  if (!hasPermission) return null
  return enhanceGameMapWithContent(ctx, map, viewAsPlayerId)
}

export const deleteMap = async (
  ctx: MutationCtx,
  mapId: Id<'gameMaps'>,
): Promise<Id<'gameMaps'>> => {
  const rawMap = await ctx.db.get(mapId)
  if (!rawMap) {
    throw new Error('Map not found')
  }

  const map = await enhanceSidebarItem(ctx, rawMap as GameMapFromDb)
  await requireFullAccessPermission(ctx, map)

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
