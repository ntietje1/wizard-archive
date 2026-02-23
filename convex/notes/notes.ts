import { deleteBlocksByNote } from '../blocks/blocks'
import { checkItemAccess, requireItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteSidebarItemShares } from '../shares/itemShares'
import { deleteItemBookmarks } from '../bookmarks/functions/deleteItemBookmarks'
import { enhanceNoteWithContent } from './helpers'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { NoteWithContent } from './types'
import type { Id } from '../_generated/dataModel'

export const getNote = async (
  ctx: CampaignQueryCtx,
  noteId: Id<'notes'>,
): Promise<NoteWithContent | null> => {
  const rawNote = await ctx.db.get(noteId)
  const note = await checkItemAccess(ctx, rawNote, PERMISSION_LEVEL.VIEW)
  if (!note) return null
  return enhanceNoteWithContent(ctx, note)
}

export async function deleteNote(
  ctx: CampaignMutationCtx,
  noteId: Id<'notes'>,
): Promise<Id<'notes'>> {
  const rawNote = await ctx.db.get(noteId)
  await requireItemAccess(ctx, rawNote, PERMISSION_LEVEL.FULL_ACCESS)

  await deleteBlocksByNote(ctx, noteId)
  await deleteSidebarItemShares(ctx, noteId)
  await deleteItemBookmarks(ctx, noteId)
  await ctx.db.delete(noteId)

  return noteId
}
