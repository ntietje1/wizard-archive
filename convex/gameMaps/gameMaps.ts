import { checkItemAccess } from '../sidebarItems/validation'
import { deleteItemSharesAndBookmarks } from '../sidebarItems/cascadeDelete'
import { PERMISSION_LEVEL } from '../shares/types'
import { enhanceGameMapWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
import type { MutationCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import type { GameMapWithContent } from './types'

export const getMap = async (
  ctx: CampaignQueryCtx,
  mapId: Id<'gameMaps'>,
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get(mapId)
  const map = await checkItemAccess(ctx, rawMap, PERMISSION_LEVEL.VIEW)
  if (!map) return null
  return enhanceGameMapWithContent(ctx, map)
}

export async function deleteMap(
  ctx: MutationCtx,
  mapId: Id<'gameMaps'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const pins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()

  for (const pin of pins) {
    await ctx.db.delete(pin._id)
  }

  await deleteItemSharesAndBookmarks(ctx, campaignId, mapId)
  await ctx.db.delete(mapId)
}
