import { checkItemAccess } from '../../sidebarItems/validation'
import { loadSingleExtensionData } from '../../sidebarItems/functions/loadExtensionData'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { enhanceNoteWithContent } from './enhanceNote'
import type { AuthQueryCtx } from '../../functions'
import type { NoteWithContent, NoteFromDb } from '../types'
import type { Id } from '../../_generated/dataModel'

export const getNote = async (
  ctx: AuthQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<NoteWithContent | null> => {
  const rawItem = await ctx.db.get('sidebarItems', noteId)
  if (!rawItem) return null
  const rawNote = (await loadSingleExtensionData(ctx, rawItem)) as NoteFromDb
  const note = await checkItemAccess(ctx, {
    rawItem: rawNote,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!note) return null
  return await enhanceNoteWithContent(ctx, { note })
}
