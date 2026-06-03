'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'
import { blockVisibilityPermissionLevelValidator } from './schema'
import { yjsUpdatesToBlocks } from '../notes/blocknoteNode'
import type { ActionCtx } from '../_generated/server'
import type { Id } from '../_generated/dataModel'

async function readProjectedBlocks(
  ctx: { runQuery: ActionCtx['runQuery'] },
  noteId: Id<'sidebarItems'>,
) {
  const updates = await ctx.runQuery(internal.yjsSync.internalQueries.listUpdatesForDocument, {
    documentId: noteId,
  })
  return yjsUpdatesToBlocks(updates)
}

async function authorizeBlockShareAction(
  ctx: { runMutation: ActionCtx['runMutation'] },
  args: {
    campaignId: Id<'campaigns'>
    noteId: Id<'sidebarItems'>
  },
) {
  await ctx.runMutation(internal.blockShares.internalMutations.authorizeBlockShareAction, {
    campaignId: args.campaignId,
    noteId: args.noteId,
  })
}

export const setBlocksShareStatus = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareAction(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.setBlocksShareStatus, {
      ...args,
      content: await readProjectedBlocks(ctx, args.noteId),
    })
    return null
  },
})

export const shareBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareAction(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.shareBlocks, {
      ...args,
      content: await readProjectedBlocks(ctx, args.noteId),
    })
    return null
  },
})

export const unshareBlocks = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareAction(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.unshareBlocks, {
      ...args,
      content: await readProjectedBlocks(ctx, args.noteId),
    })
    return null
  },
})

export const setBlockMemberPermission = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: v.nullable(blockVisibilityPermissionLevelValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareAction(ctx, args)
    await ctx.runMutation(internal.blockShares.internalMutations.setBlockMemberPermission, {
      ...args,
      content: await readProjectedBlocks(ctx, args.noteId),
    })
    return null
  },
})
