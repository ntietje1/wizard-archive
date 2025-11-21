import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { Ctx } from "../common/types";
import { getNote } from "./notes";
import { Block, Note } from "./types";


export const findBlockByBlockNoteId = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
  blockId: string
): Promise<Block | null> => {
  const note: Note | null = await getNote(ctx, noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) => q
      .eq('campaignId', note.campaignId)
      .eq('noteId', noteId)
      .eq('blockId', blockId)
    )
    .unique()

  return block
}

export async function getBlocksByNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) => q.eq('campaignId', campaignId).eq('noteId', noteId)
    )
    .collect()
}

export async function getTopLevelBlocksByNote(
  ctx: Ctx,
  noteId: Id<'notes'>,
  campaignId: Id<'campaigns'>
): Promise<Block[]> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) => q
      .eq('campaignId', campaignId)
      .eq('noteId', noteId)
      .eq('isTopLevel', true)
    )
    .collect()

  return blocks.sort((a, b) => (a.position || 0) - (b.position || 0))
}

export async function getBlocksByCampaign(
  ctx: Ctx,
  campaignId: Id<'campaigns'>
): Promise<Block[]> {
  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_toplevel_pos', (q) => q.eq('campaignId', campaignId)
    )
    .collect()
}

async function deleteBlockTags(
  ctx: MutationCtx,
  blockId: Id<'blocks'>,
  campaignId: Id<'campaigns'>
): Promise<void> {
  const blockTags = await ctx.db
    .query('blockTags')
    .withIndex('by_campaign_block_tag', (q) => q.eq('campaignId', campaignId).eq('blockId', blockId)
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
  campaignId: Id<'campaigns'>
): Promise<void> {
  const blocks = await getBlocksByNote(ctx, noteId, campaignId)

  for (const block of blocks) {
    await deleteBlockTags(ctx, block._id, campaignId)
  }
}

