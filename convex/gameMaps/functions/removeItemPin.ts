import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function removeItemPin(
  ctx: AuthMutationCtx,
  { mapPinId }: { mapPinId: Id<'mapPins'> },
): Promise<Id<'mapPins'>> {
  await requirePinAccess(ctx, { mapPinId })

  const now = Date.now()
  await ctx.db.patch(mapPinId, {
    deletionTime: now,
    deletedBy: ctx.user.profile._id,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
  return mapPinId
}
