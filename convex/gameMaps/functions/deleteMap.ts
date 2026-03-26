import { deleteSidebarItemShares } from '../../sidebarShares/functions/sidebarItemShareMutations'
import { deleteItemBookmarks } from '../../bookmarks/functions/deleteItemBookmarks'
import { requireItemAccess } from '../../sidebarItems/validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function deleteMap(
  ctx: AuthMutationCtx,
  { mapId }: { mapId: Id<'gameMaps'> },
): Promise<Id<'gameMaps'>> {
  const mapFromDb = await ctx.db.get(mapId)
  if (!mapFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  const pins = await ctx.db
    .query('mapPins')
    .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
    .collect()

  await Promise.all(
    pins.map((pin) => {
      ctx.db.delete(pin._id)
    }),
  )

  await deleteSidebarItemShares(ctx, { sidebarItemId: mapId })
  await deleteItemBookmarks(ctx, { sidebarItemId: mapId })
  await ctx.db.delete(mapId)
  return map._id
}
