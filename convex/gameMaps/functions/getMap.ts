import { checkItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { enhanceGameMapWithContent } from './enhanceMap'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { GameMapFromDb, GameMapWithContent } from '../types'

export const getMap = async (
  ctx: AuthQueryCtx,
  { mapId }: { mapId: Id<'sidebarItems'> },
): Promise<GameMapWithContent | null> => {
  const rawItem = await ctx.db.get('sidebarItems', mapId)
  if (!rawItem) return null
  await requireCampaignMembership(ctx, rawItem.campaignId)
  const rawMap = (await loadSingleExtensionData(ctx, rawItem)) as GameMapFromDb
  const map = await checkItemAccess(ctx, {
    rawItem: rawMap,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!map) return null
  return await enhanceGameMapWithContent(ctx, { gameMap: map })
}
