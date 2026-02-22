import { deleteBlocksByNote } from '../blocks/blocks'
import { deleteItemSharesAndBookmarks } from '../sidebarItems/cascadeDelete'
import { checkItemAccess, requireItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../shares/types'
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
  const note = await requireItemAccess(ctx, ctx.campaign._id, rawNote, PERMISSION_LEVEL.FULL_ACCESS)

  await deleteBlocksByNote(ctx, noteId, note.campaignId)
  await deleteItemSharesAndBookmarks(ctx, note.campaignId, noteId)
  await ctx.db.delete(noteId)

  return noteId
}
