import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { editorBlockInputValidator } from '../blocks/schema'
import {
  RESOURCE_COMMAND_TYPE,
  RESOURCE_EVENT_TYPE,
} from '@wizard-archive/editor/resources/transaction-contract'
import { blockShareCommandValidator } from './commandValidators'
import {
  fileSystemRequestFingerprint,
  recordFilesystemTransaction,
} from '../sidebarItems/filesystem/transactions'
import { fileSystemTransactionReceiptValidator } from '../sidebarItems/filesystem/validators'
import { setBlocksShareStatus as setBlocksShareStatusFn } from './functions/setBlocksShareStatus'
import { setBlockMemberPermission as setBlockMemberPermissionFn } from './functions/setBlockMemberPermission'
import { parseBlockNoteBlocks } from '../blocks/parseBlockNoteBlocks'
import { authenticate, checkDmMembership } from '../functions'
import { syncNoteIndexesFromBlocks } from '../notes/functions/syncNoteDerivedData'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import { normalizeBlockShareTargetIds } from './blockShareCommand'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import type { NoteBlockId, OperationId } from '@wizard-archive/editor/resources/domain-id'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { operationIdValidator } from '../resources/validators'
import type {
  ResourceCommand,
  ResourceTransactionReceipt,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { CampaignMemberRow, CampaignRow } from '../../shared/campaigns/types'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type BlockShareCommand = Extract<
  ResourceCommand,
  {
    type:
      | typeof RESOURCE_COMMAND_TYPE.setBlocksShareStatus
      | typeof RESOURCE_COMMAND_TYPE.setBlockMemberPermission
  }
>

type ProjectedNoteArgs = {
  campaignId: Id<'campaigns'>
  noteId: Id<'sidebarItems'>
  content: Array<NoteBlock>
}

async function authorizeBlockShareMutation(
  ctx: MutationCtx,
  args: Pick<ProjectedNoteArgs, 'campaignId' | 'noteId'>,
) {
  const user = await authenticate(ctx)
  const { campaign } = await checkDmMembership({ ...ctx, user }, args.campaignId)
  const note = await ctx.db.get('sidebarItems', args.noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.campaignId !== campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
}

async function getBlockShareCtx(ctx: MutationCtx, args: ProjectedNoteArgs) {
  const user = await authenticate(ctx)
  const { campaign, membership } = await checkDmMembership({ ...ctx, user }, args.campaignId)
  await syncProjectedNote(
    { ...ctx, campaign, membership },
    { noteId: args.noteId, content: args.content },
  )
  return {
    ...ctx,
    campaign,
    membership,
    resourceScope: {
      campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid),
      actorId: assertDomainId(DOMAIN_ID_KIND.campaignMember, membership.campaignMemberUuid),
    },
  }
}

async function syncProjectedNote(
  ctx: MutationCtx & {
    campaign: CampaignRow
    membership: CampaignMemberRow
  },
  args: Pick<ProjectedNoteArgs, 'noteId' | 'content'>,
) {
  const note = await ctx.db.get('sidebarItems', args.noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
  await syncNoteIndexesFromBlocks(ctx, args)
}

async function executeProjectedBlockShareCommand(
  ctx: MutationCtx,
  args: {
    campaignId: Id<'campaigns'>
    command: BlockShareCommand
    content: Array<NoteBlock>
    historyStatus?: 'shared' | 'unshared'
    operationId: OperationId
  },
): Promise<ResourceTransactionReceipt> {
  const blockNoteIds = normalizeBlockShareTargetIds(args.command.blockNoteIds)
  const command = {
    ...args.command,
    blockNoteIds,
  } as BlockShareCommand
  const blockShareCtx = await getBlockShareCtx(ctx, {
    campaignId: args.campaignId,
    noteId: command.noteId,
    content: args.content,
  })

  let changedBlockNoteIds: Array<NoteBlockId>
  switch (command.type) {
    case RESOURCE_COMMAND_TYPE.setBlocksShareStatus:
      changedBlockNoteIds = await setBlocksShareStatusFn(blockShareCtx, {
        noteId: command.noteId,
        blockNoteIds,
        status: command.status,
      })
      break
    case RESOURCE_COMMAND_TYPE.setBlockMemberPermission:
      changedBlockNoteIds = await setBlockMemberPermissionFn(blockShareCtx, {
        noteId: command.noteId,
        blockNoteIds,
        campaignMemberId: command.campaignMemberId,
        permissionLevel: command.permissionLevel,
        historyStatus: args.historyStatus,
      })
      break
  }

  const events =
    changedBlockNoteIds.length === 0
      ? []
      : [{ type: RESOURCE_EVENT_TYPE.updated, itemId: command.noteId }]
  return await recordFilesystemTransaction(blockShareCtx, {
    delta: {
      command,
      events,
      changes: [],
      undoable: false,
    },
    requestFingerprint: fileSystemRequestFingerprint(command),
    operationId: args.operationId,
  })
}

export const authorizeBlockShareAction = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await authorizeBlockShareMutation(ctx, args)
    return null
  },
})

export const executeBlockShareCommand = internalMutation({
  args: {
    campaignId: v.id('campaigns'),
    command: blockShareCommandValidator,
    content: v.array(editorBlockInputValidator),
    historyStatus: v.optional(v.union(v.literal('shared'), v.literal('unshared'))),
    operationId: operationIdValidator,
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    const content = parseBlockNoteBlocks(args.content)
    return await executeProjectedBlockShareCommand(ctx, {
      campaignId: args.campaignId,
      command: args.command as BlockShareCommand,
      content,
      historyStatus: args.historyStatus,
      operationId: args.operationId,
    })
  },
})
