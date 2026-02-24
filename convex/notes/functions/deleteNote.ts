import { deleteBlocksByNote } from '../../blocks/blocks'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import { deleteSidebarItemShares } from '../../shares/itemShares'
import { deleteItemBookmarks } from '../../bookmarks/functions/deleteItemBookmarks'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function deleteNote(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<Id<'notes'>> {
  const noteFromDb = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: noteFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await deleteBlocksByNote(ctx, { noteId })
  await deleteSidebarItemShares(ctx, { sidebarItemId: noteId })
  await deleteItemBookmarks(ctx, { sidebarItemId: noteId })
  await ctx.db.delete(noteId)

  return note._id
}
