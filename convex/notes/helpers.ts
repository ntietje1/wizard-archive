import { MutationCtx, QueryCtx } from '../_generated/server'
import { Id } from '../_generated/dataModel'
import { Block } from './types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { deleteTagAndCleanupContent } from '../tags/tags'

export async function getBlocksByNote(
  ctx: QueryCtx | MutationCtx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()
}

export async function getTopLevelBlocksByNote(
  ctx: QueryCtx | MutationCtx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('isTopLevel', true),
    )
    .collect()

  return blocks.sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getBlocksByCampaign(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaigns'>,
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) =>
      q.eq('campaignId', campaignId),
    )
    .collect()
}

async function deleteBlockTags(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blockTags = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) =>
      q.eq('campaignId', campaignId).eq('blockId', blockId),
    )
    .collect()

  for (const blockTag of blockTags) {
    await ctx.db.delete(blockTag._id)
  }
  await ctx.db.delete(blockId)
}

export async function deleteNoteBlocks(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const blocks = await getBlocksByNote(ctx, noteId, campaignId)

  for (const block of blocks) {
    await deleteBlockTags(ctx, block._id, campaignId)
  }
}

export async function deleteNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
): Promise<Id<'notes'>> {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  await deleteNoteBlocks(ctx, noteId, note.campaignId)
  if (note.tagId) {
    await deleteTagAndCleanupContent(ctx, note.tagId)
  }
  await ctx.db.delete(noteId)

  return noteId
}
