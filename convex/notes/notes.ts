import { deleteBlocksByNote } from '../blocks/blocks'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  hasViewPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { enhanceNoteWithContent } from './helpers'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { NoteWithContent } from './types'
import type { Id } from '../_generated/dataModel'

export const getNote = async (
  ctx: CampaignQueryCtx,
  noteId: Id<'notes'>,
): Promise<NoteWithContent | null> => {
  const rawNote = await ctx.db.get(noteId)
  if (!rawNote) return null

  const note = await enhanceSidebarItem(ctx, rawNote)
  const hasPermission = await hasViewPermission(ctx, note)
  if (!hasPermission) return null
  return enhanceNoteWithContent(ctx, note)
}

export async function deleteNote(
  ctx: CampaignMutationCtx,
  noteId: Id<'notes'>,
): Promise<Id<'notes'>> {
  const rawNote = await ctx.db.get(noteId)
  if (!rawNote) {
    throw new Error('Note not found')
  }

  const note = await enhanceSidebarItem(ctx, rawNote)
  await requireFullAccessPermission(ctx, note)

  await deleteBlocksByNote(ctx, noteId, note.campaignId)
  await ctx.db.delete(noteId)

  return noteId
}
