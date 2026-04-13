import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { campaignQuery, dmQuery } from '../functions'
import { blockShareValidator } from '../blockShares/schema'
import { campaignMemberValidator } from '../campaigns/schema'
import { blockNoteIdValidator, blockShareStatusValidator, blockValidator } from './schema'
import { blockTypeSchema } from './blockSchemas'
import { getBlockWithShares as getBlockWithSharesFn } from './functions/getBlockWithShares'
import { getBlocksWithShares as getBlocksWithSharesFn } from './functions/getBlocksWithShares'
import { getHeadingsByNote as getHeadingsByNoteFn } from './functions/getHeadingsByNote'
import { searchBlocks as searchBlocksFn } from './functions/searchBlocks'

export const getBlockWithShares = dmQuery({
  args: {
    noteId: v.id('sidebarItems'),
    blockNoteId: blockNoteIdValidator,
  },
  returns: v.union(
    v.object({
      block: blockValidator,
      shareStatus: blockShareStatusValidator,
      shares: v.array(blockShareValidator),
      playerMembers: v.array(campaignMemberValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await getBlockWithSharesFn(ctx, {
      noteId: args.noteId,
      blockNoteId: args.blockNoteId,
    })
  },
})

const blockShareInfoValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  shareStatus: blockShareStatusValidator,
  sharedMemberIds: v.array(v.id('campaignMembers')),
})

export const getBlocksWithShares = dmQuery({
  args: {
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
  },
  returns: v.object({
    blocks: v.array(blockShareInfoValidator),
    playerMembers: v.array(campaignMemberValidator),
  }),
  handler: async (ctx, args) => {
    return await getBlocksWithSharesFn(ctx, {
      noteId: args.noteId,
      blockNoteIds: args.blockNoteIds,
    })
  },
})

const headingResultValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  text: v.string(),
  level: v.number(),
  normalizedText: v.string(),
})

export const getHeadingsByNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.array(headingResultValidator),
  handler: async (ctx, args) => {
    return await getHeadingsByNoteFn(ctx, { noteId: args.noteId })
  },
})

const blockSearchResultValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  noteId: v.id('sidebarItems'),
  plainText: v.string(),
  type: zodToConvex(blockTypeSchema),
})

export const searchBlocks = campaignQuery({
  args: {
    query: v.string(),
  },
  returns: v.array(blockSearchResultValidator),
  handler: async (ctx, args) => {
    return await searchBlocksFn(ctx, { query: args.query })
  },
})
