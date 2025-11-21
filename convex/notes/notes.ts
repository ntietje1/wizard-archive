import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Ctx } from '../common/types'
import { Id } from '../_generated/dataModel'
import {
  Note,
  NoteWithContent,
} from './types'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { deleteNoteBlocks, getTopLevelBlocksByNote } from './blocks'
import { deleteTagAndCleanupContent, getTag } from '../tags/tags'
import { MutationCtx } from '../_generated/server'

export const getNote = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<Note | null> => {
  const note = await ctx.db.get(noteId)
  if (!note) {
    return null
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const tag = note.tagId ? await getTag(ctx, note.tagId) : undefined
  const category = tag?.category

  return {
    ...note,
    type: SIDEBAR_ITEM_TYPES.notes,
    tag,
    category,
  }
}

export const getNoteWithContent = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<NoteWithContent | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    return null
  }

  const [topLevelBlocks] = await Promise.all([
    getTopLevelBlocksByNote(ctx, note._id, note.campaignId),
  ])

  const content = topLevelBlocks.map((block) => block.content)

  return {
    ...note,
    content,
  }
}

export const getNoteBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<NoteWithContent | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  if (!note) {
    return null
  }

  return getNoteWithContent(ctx, note._id)
}

export async function deleteNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  options?: { cascadeTag?: boolean} 
): Promise<Id<'notes'>> {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] }
  )

  await deleteNoteBlocks(ctx, noteId, note.campaignId)
  const shouldCascadeTag = options?.cascadeTag !== false
  if (shouldCascadeTag && note.tagId) {
    await deleteTagAndCleanupContent(ctx, note.tagId)
  }
  await ctx.db.delete(noteId)

  return noteId
}

