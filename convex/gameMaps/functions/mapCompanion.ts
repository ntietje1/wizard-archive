import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createMapCompanion(
  ctx: CampaignMutationCtx,
  {
    mapId,
  }: {
    mapId: Id<'sidebarItems'>
  },
): Promise<Id<'gameMaps'>> {
  const sidebarItem = await ctx.db.get('sidebarItems', mapId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.gameMaps) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Map companion requires a map sidebar item')
  }
  const existingMap = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
    .unique()
  if (existingMap) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Map companion already exists')
  }

  const gameMapId = await ctx.db.insert('gameMaps', {
    sidebarItemId: mapId,
    imageStorageId: null,
  })

  await logEditHistory(ctx, {
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    action: EDIT_HISTORY_ACTION.created,
  })
  return gameMapId
}
