'use node'

import { v } from 'convex/values'
import { action } from '../_generated/server'
import { internal } from '../_generated/api'
import { RESOURCE_COMMAND_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import { fileSystemTransactionReceiptValidator } from '../sidebarItems/filesystem/validators'
import { blockNoteIdValidator, blockShareStatusValidator } from '../blocks/schema'
import { blockVisibilityPermissionLevelValidator } from './schema'
import { yjsUpdatesToBlocks } from '../notes/blocknoteNode'
import { normalizeBlockShareTargetIds } from './blockShareCommand'
import type { ActionCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type {
  ResourceCommand,
  ResourceTransactionReceipt,
} from '@wizard-archive/editor/resources/transaction-contract'

type BlockShareActionCtx = Pick<ActionCtx, 'runMutation' | 'runQuery'>
type BlockShareActionCommand = Extract<
  ResourceCommand,
  {
    type:
      | typeof RESOURCE_COMMAND_TYPE.setBlocksShareStatus
      | typeof RESOURCE_COMMAND_TYPE.setBlockMemberPermission
  }
>

async function readProjectedBlocks(
  ctx: Pick<ActionCtx, 'runQuery'>,
  noteId: Id<'sidebarItems'>,
): Promise<Array<NoteBlock>> {
  const updates: Array<Pick<Doc<'yjsUpdates'>, 'update'>> = await ctx.runQuery(
    internal.yjsSync.internalQueries.listUpdatesForDocument,
    {
      documentId: noteId,
    },
  )
  return yjsUpdatesToBlocks(updates)
}

async function executeProjectedBlockShareCommand(
  ctx: BlockShareActionCtx,
  args: {
    campaignId: Id<'campaigns'>
    command: BlockShareActionCommand
    historyStatus?: 'shared' | 'unshared'
  },
): Promise<ResourceTransactionReceipt> {
  await ctx.runMutation(internal.blockShares.internalMutations.authorizeBlockShareAction, {
    campaignId: args.campaignId,
    noteId: args.command.noteId,
  })
  const command = {
    ...args.command,
    blockNoteIds: normalizeBlockShareTargetIds(args.command.blockNoteIds),
  } as BlockShareActionCommand
  const content = await readProjectedBlocks(ctx, command.noteId)
  const receipt: ResourceTransactionReceipt = await ctx.runMutation(
    internal.blockShares.internalMutations.executeBlockShareCommand,
    {
      campaignId: args.campaignId,
      command,
      content,
      historyStatus: args.historyStatus,
    },
  )
  return receipt
}

function blockMemberPermissionCommand({
  blockNoteIds,
  campaignMemberId,
  noteId,
  permissionLevel,
}: {
  noteId: Id<'sidebarItems'>
  blockNoteIds: Array<string>
  campaignMemberId: Id<'campaignMembers'>
  permissionLevel: 'none' | 'view' | null
}): BlockShareActionCommand {
  return {
    type: RESOURCE_COMMAND_TYPE.setBlockMemberPermission,
    noteId,
    blockNoteIds,
    campaignMemberId,
    permissionLevel,
  }
}

const blockMemberActionArgs = {
  campaignId: v.id('campaigns'),
  noteId: v.id('sidebarItems'),
  blockNoteIds: v.array(blockNoteIdValidator),
  campaignMemberId: v.id('campaignMembers'),
}

function createBlockMemberPermissionHandler(
  permissionLevel: 'view' | null,
  historyStatus: 'shared' | 'unshared',
) {
  return async (
    ctx: BlockShareActionCtx,
    args: {
      campaignId: Id<'campaigns'>
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: Id<'campaignMembers'>
    },
  ): Promise<ResourceTransactionReceipt> => {
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: args.campaignId,
      command: blockMemberPermissionCommand({
        noteId: args.noteId,
        blockNoteIds: args.blockNoteIds,
        campaignMemberId: args.campaignMemberId,
        permissionLevel,
      }),
      historyStatus,
    })
  }
}

export const setBlocksShareStatus = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: args.campaignId,
      command: {
        type: RESOURCE_COMMAND_TYPE.setBlocksShareStatus,
        noteId: args.noteId,
        blockNoteIds: args.blockNoteIds,
        status: args.status,
      },
    })
  },
})

export const shareBlocks = action({
  args: blockMemberActionArgs,
  returns: fileSystemTransactionReceiptValidator,
  handler: createBlockMemberPermissionHandler('view', 'shared'),
})

export const unshareBlocks = action({
  args: blockMemberActionArgs,
  returns: fileSystemTransactionReceiptValidator,
  handler: createBlockMemberPermissionHandler(null, 'unshared'),
})

export const setBlockMemberPermission = action({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: v.id('campaignMembers'),
    permissionLevel: v.nullable(blockVisibilityPermissionLevelValidator),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: args.campaignId,
      command: blockMemberPermissionCommand({
        noteId: args.noteId,
        blockNoteIds: args.blockNoteIds,
        campaignMemberId: args.campaignMemberId,
        permissionLevel: args.permissionLevel,
      }),
    })
  },
})
