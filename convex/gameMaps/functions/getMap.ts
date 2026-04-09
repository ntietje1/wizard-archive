import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceGameMapWithContent } from './enhanceMap'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { GameMapWithContent } from '../types'

export const getMap = async (
  ctx: AuthQueryCtx,
  { mapId }: { mapId: Id<'gameMaps'> },
): Promise<GameMapWithContent | null> => {
  const rawMap = await ctx.db.get("gameMaps", mapId)
  if (!rawMap) return null
  await requireCampaignMembership(ctx, rawMap.campaignId)
  const map = await checkItemAccess(ctx, {
    rawItem: rawMap,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!map) return null
  return await enhanceGameMapWithContent(ctx, { gameMap: map })
}
