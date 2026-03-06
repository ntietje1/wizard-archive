import { checkItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { enhanceNoteWithContent } from './enhanceNote'
import type { AuthQueryCtx } from '../../functions'
import type { NoteWithContent } from '../types'
import type { Id } from '../../_generated/dataModel'

export const getNote = async (
  ctx: AuthQueryCtx,
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
