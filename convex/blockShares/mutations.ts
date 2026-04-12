import { v } from 'convex/values'
import { dmMutation } from '../functions'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { shareBlocks as shareBlocksFn } from './functions/shareBlocks'
import { unshareBlocks as unshareBlocksFn } from './functions/unshareBlocks'

const blockIdentifierValidator = v.object({
  blockNoteId: blockNoteIdValidator,
})

export const setBlocksShareStatus = dmMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blocks: v.array(blockIdentifierValidator),
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

export const shareBlocks = dmMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blocks: v.array(blockIdentifierValidator),
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

export const unshareBlocks = dmMutation({
  args: {
    noteId: v.id('sidebarItems'),
    blocks: v.array(blockIdentifierValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await unshareBlocksFn(ctx, {
      noteId: args.noteId,
      blocks: args.blocks,
      campaignMemberId: args.campaignMemberId,
    })
  },
})
