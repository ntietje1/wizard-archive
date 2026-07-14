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
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { campaignIdValidator, campaignMemberIdValidator } from '../campaigns/schema'

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
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
    },
  )
  return receipt
}

async function resolveCampaignRowId(ctx: BlockShareActionCtx, campaignId: CampaignId) {
  return await ctx.runQuery(internal.campaigns.internalQueries.resolveCampaignRowId, { campaignId })
}

async function resolveCampaignAndMemberRowIds(
  ctx: BlockShareActionCtx,
  campaignId: CampaignId,
  campaignMemberId: CampaignMemberId,
) {
  return await ctx.runQuery(internal.campaigns.internalQueries.resolveCampaignAndMemberRowIds, {
    campaignId,
    campaignMemberId,
  })
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
  campaignId: campaignIdValidator,
  noteId: v.id('sidebarItems'),
  blockNoteIds: v.array(blockNoteIdValidator),
  campaignMemberId: campaignMemberIdValidator,
}

function createBlockMemberPermissionHandler(
  permissionLevel: 'view' | null,
  historyStatus: 'shared' | 'unshared',
) {
  return async (
    ctx: BlockShareActionCtx,
    args: {
      campaignId: CampaignId
      noteId: Id<'sidebarItems'>
      blockNoteIds: Array<string>
      campaignMemberId: CampaignMemberId
    },
  ): Promise<ResourceTransactionReceipt> => {
    const rowIds = await resolveCampaignAndMemberRowIds(ctx, args.campaignId, args.campaignMemberId)
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: rowIds.campaignId,
      command: blockMemberPermissionCommand({
        noteId: args.noteId,
        blockNoteIds: args.blockNoteIds,
        campaignMemberId: rowIds.campaignMemberId,
        permissionLevel,
      }),
      historyStatus,
    })
  }
}

export const setBlocksShareStatus = action({
  args: {
    campaignId: campaignIdValidator,
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    status: blockShareStatusValidator,
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    const campaignId = await resolveCampaignRowId(ctx, args.campaignId)
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId,
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
    campaignId: campaignIdValidator,
    noteId: v.id('sidebarItems'),
    blockNoteIds: v.array(blockNoteIdValidator),
    campaignMemberId: campaignMemberIdValidator,
    permissionLevel: v.nullable(blockVisibilityPermissionLevelValidator),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    const rowIds = await resolveCampaignAndMemberRowIds(ctx, args.campaignId, args.campaignMemberId)
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: rowIds.campaignId,
      command: blockMemberPermissionCommand({
        noteId: args.noteId,
        blockNoteIds: args.blockNoteIds,
        campaignMemberId: rowIds.campaignMemberId,
        permissionLevel: args.permissionLevel,
      }),
    })
  },
})
