import { checkItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { enhanceGameMapWithContent } from './helpers'
import type { CampaignQueryCtx } from '../functions'
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
