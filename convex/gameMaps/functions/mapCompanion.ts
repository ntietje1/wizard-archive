import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../shared/edit-history/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
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

export async function copyMapCompanion(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const targetItem = await ctx.db.get('sidebarItems', targetItemId)
  if (!targetItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Map target item not found')
  if (targetItem.type !== SIDEBAR_ITEM_TYPES.gameMaps) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Map companion requires a map item')
  }
  const existingMap = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', targetItemId))
    .unique()
  if (existingMap) {
    throwClientError(ERROR_CODE.CONFLICT, 'Map companion already exists')
  }
  const sourceMap = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', sourceItemId))
    .unique()
  if (!sourceMap) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Missing map companion for sidebar item ${sourceItemId}`,
    )
  }
  await ctx.db.insert('gameMaps', {
    sidebarItemId: targetItemId,
    imageStorageId: sourceMap.imageStorageId,
  })
}
