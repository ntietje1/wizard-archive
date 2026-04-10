import { v } from 'convex/values'
import { authMutation } from '../functions'
import {
  blockNoteIdValidator,
  blockShareStatusValidator,
  customBlockValidator,
} from '../blocks/schema'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { shareBlocks as shareBlocksFn } from './functions/shareBlocks'
import { unshareBlocks as unshareBlocksFn } from './functions/unshareBlocks'

const blockItemValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  content: customBlockValidator,
})

export const setBlocksShareStatus = authMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blocks: v.array(blockItemValidator),
    status: blockShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await setBlocksShareStatusFn(ctx, {
      noteId: args.noteId,
      blocks: args.blocks,
      status: args.status,
    })
  },
})

export const shareBlocks = authMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blocks: v.array(blockItemValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await shareBlocksFn(ctx, {
      noteId: args.noteId,
      blocks: args.blocks,
      campaignMemberId: args.campaignMemberId,
    })
  },
})

export const unshareBlocks = authMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await unshareBlocksFn(ctx, {
      noteId: args.noteId,
      blockNoteIds: args.blockNoteIds,
      campaignMemberId: args.campaignMemberId,
    })
  },
})
