import { checkItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteItemBookmarks } from '../bookmarks/functions/deleteItemBookmarks'
import { deleteSidebarItemShares } from '../shares/itemShares'
import { enhanceGameMapWithContent } from './helpers'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
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
  ctx: CampaignMutationCtx,
  mapId: Id<'gameMaps'>,
): Promise<void> {
  const pins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()

  for (const pin of pins) {
    await ctx.db.delete(pin._id)
  }

  await deleteSidebarItemShares(ctx, mapId)
  await deleteItemBookmarks(ctx, mapId)
  await ctx.db.delete(mapId)
}
