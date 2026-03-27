import { requirePinAccess } from './requirePinAccess'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function updatePinVisibility(
  ctx: AuthMutationCtx,
  { mapPinId, visible }: { mapPinId: Id<'mapPins'>; visible: boolean },
): Promise<Id<'mapPins'>> {
  await requirePinAccess(ctx, { mapPinId })

  await ctx.db.patch(mapPinId, {
    visible,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  return mapPinId
}
