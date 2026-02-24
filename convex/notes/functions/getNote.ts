import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import { enhanceNoteWithContent } from './enhanceNote'
import type { CampaignQueryCtx } from '../../functions'
import type { NoteWithContent } from '../types'
import type { Id } from '../../_generated/dataModel'

export const getNote = async (
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<NoteWithContent | null> => {
  const rawNote = await ctx.db.get(noteId)
  const note = await checkItemAccess(ctx, {
    rawItem: rawNote,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!note) return null
  return await enhanceNoteWithContent(ctx, { note })
}
