import { saveTopLevelBlocksForNote } from '../../blocks/blocks'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'

export async function updateNoteContent(
  ctx: CampaignMutationCtx,
  { noteId, content }: { noteId: Id<'notes'>; content: Array<CustomBlock> },
): Promise<Id<'notes'>> {
  const noteFromDb = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: noteFromDb,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })
  await saveTopLevelBlocksForNote(ctx, { noteId, content })
  return note._id
}
