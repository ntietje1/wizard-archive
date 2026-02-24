import {
  requireItemAccess,
  validateSidebarMove,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function moveNote(
  ctx: CampaignMutationCtx,
  { noteId, parentId }: { noteId: Id<'notes'>; parentId?: Id<'folders'> },
): Promise<Id<'notes'>> {
  const noteFromDb = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: noteFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await validateSidebarMove(ctx, { item: note, newParentId: parentId })

  await ctx.db.patch(noteId, {
    parentId,
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  })
  return note._id
}
