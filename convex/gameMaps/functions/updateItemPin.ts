import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updateItemPin(
  ctx: AuthMutationCtx,
  {
    mapPinId,
    x,
    y,
  }: {
    mapPinId: Id<'mapPins'>
    x: number
    y: number
  },
): Promise<Id<'mapPins'>> {
  await requirePinAccess(ctx, { mapPinId })

  await ctx.db.patch(mapPinId, {
    x,
    y,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return mapPinId
}
