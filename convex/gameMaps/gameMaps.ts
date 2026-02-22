import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { hasViewPermission } from '../shares/itemShares'
import { enhanceGameMapWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type { GameMapWithContent } from './types'

export const getMap = async (
  ctx: CampaignQueryCtx,
  mapId: Id<'gameMaps'>,
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get(mapId)
  if (!rawMap) return null

  const map = await enhanceSidebarItem(ctx, rawMap)
  const hasPermission = await hasViewPermission(ctx, map)
  if (!hasPermission) return null
  return enhanceGameMapWithContent(ctx, map)
}
