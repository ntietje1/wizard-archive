import { v } from 'convex/values'
import { campaignMutation } from '../../functions'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { assertNever } from '../../common/types'
import { RESOURCE_COMMAND_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import type {
  ResourceCommand,
  ResourceOperationDecision,
  ResourceTransactionReceipt,
} from '@wizard-archive/editor/resources/transaction-contract'
import { executeCreateCommand } from './commandModules/create'
import { executeRenameCommand } from './commandModules/rename'
import { executeCopyCommand } from './commandModules/copy'
import { executeMoveCommand } from './commandModules/move'
import { executeDeleteForeverCommand } from './commandModules/deleteForever'
import { executeEmptyTrashCommand } from './commandModules/emptyTrash'
import { executeShareCommand } from './commandModules/share'
import { executeToggleBookmarksCommand } from './commandModules/bookmark'
import {
  applyFilesystemTransactionDirection,
  fileSystemRequestFingerprint,
  loadIdempotentFilesystemReceipt,
  recordFilesystemTransaction,
} from './transactions'
import {
  fileSystemCommandValidator,
  fileSystemOperationDecisionValidator,
  fileSystemTransactionReceiptValidator,
} from './validators'
import type { StoredResourceDelta } from './deltas'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
const MAX_FILE_SYSTEM_COMMAND_ITEMS = 100

type FileSystemCommandWithItemIds = Extract<ResourceCommand, { itemIds: Array<Id<'sidebarItems'>> }>

function uniqueItemIds(itemIds: Array<Id<'sidebarItems'>>) {
  return Array.from(new Set(itemIds))
}

function commandHasItemIds(command: ResourceCommand): command is FileSystemCommandWithItemIds {
  return 'itemIds' in command
}

function normalizeCommand(command: ResourceCommand): ResourceCommand {
  return commandHasItemIds(command)
    ? { ...command, itemIds: uniqueItemIds(command.itemIds) }
    : command
}

function commandItemIds(command: ResourceCommand): Array<Id<'sidebarItems'>> {
  return commandHasItemIds(command) ? command.itemIds : []
}

function assertCommandSize(command: ResourceCommand) {
  if (commandItemIds(command).length > MAX_FILE_SYSTEM_COMMAND_ITEMS) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Batch size cannot exceed ${MAX_FILE_SYSTEM_COMMAND_ITEMS} items`,
    )
  }
}

async function executeCommand(
  ctx: CampaignMutationCtx,
  {
    command,
    decisions,
  }: {
    command: ResourceCommand
    decisions?: Array<ResourceOperationDecision>
  },
): Promise<StoredResourceDelta> {
  assertCommandSize(command)

  switch (command.type) {
    case RESOURCE_COMMAND_TYPE.create:
      return await executeCreateCommand(ctx, { command })
    case RESOURCE_COMMAND_TYPE.rename:
      return await executeRenameCommand(ctx, { command })
    case RESOURCE_COMMAND_TYPE.copy:
      return await executeCopyCommand(ctx, { command, decisions })
    case RESOURCE_COMMAND_TYPE.move:
      return await executeMoveCommand(ctx, { command, action: 'move', decisions })
    case RESOURCE_COMMAND_TYPE.restore:
      return await executeMoveCommand(ctx, {
        command,
        action: 'restore',
        decisions,
      })
    case RESOURCE_COMMAND_TYPE.trash:
      return await executeMoveCommand(ctx, { command, action: 'trash', decisions })
    case RESOURCE_COMMAND_TYPE.deleteForever:
      return await executeDeleteForeverCommand(ctx, { command })
    case RESOURCE_COMMAND_TYPE.emptyTrash:
      return await executeEmptyTrashCommand(ctx, { command })
    case RESOURCE_COMMAND_TYPE.setResourceAudiencePermission:
    case RESOURCE_COMMAND_TYPE.setResourcesMemberPermission:
    case RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission:
    case RESOURCE_COMMAND_TYPE.setFolderInheritShares:
      return await executeShareCommand(ctx, { command })
    case RESOURCE_COMMAND_TYPE.setBlocksShareStatus:
    case RESOURCE_COMMAND_TYPE.setBlockMemberPermission:
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Block share commands must be executed through block share actions',
      )
    case RESOURCE_COMMAND_TYPE.toggleBookmarks:
      return await executeToggleBookmarksCommand(ctx, { command })
  }
  return assertNever(command)
}

export const executeFileSystemCommand = campaignMutation({
  args: {
    command: fileSystemCommandValidator,
    decisions: v.optional(v.array(fileSystemOperationDecisionValidator)),
    clientOperationId: v.optional(v.string()),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    const command = normalizeCommand(args.command as ResourceCommand)
    const decisions = args.decisions as Array<ResourceOperationDecision> | undefined
    const requestFingerprint = fileSystemRequestFingerprint({ command, decisions })
    const existing = await loadIdempotentFilesystemReceipt(
      ctx,
      args.clientOperationId,
      requestFingerprint,
    )
    if (existing) return existing

    const delta = await executeCommand(ctx, {
      command,
      decisions,
    })
    return await recordFilesystemTransaction(ctx, {
      delta,
      clientOperationId: args.clientOperationId,
      requestFingerprint,
    })
  },
})

export const undoFileSystemTransaction = campaignMutation({
  args: {
    transactionId: v.id('filesystemTransactions'),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    return await applyFilesystemTransactionDirection(ctx, {
      transactionId: args.transactionId,
      direction: 'undo',
    })
  },
})

export const redoFileSystemTransaction = campaignMutation({
  args: {
    transactionId: v.id('filesystemTransactions'),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<ResourceTransactionReceipt> => {
    return await applyFilesystemTransactionDirection(ctx, {
      transactionId: args.transactionId,
      direction: 'redo',
    })
  },
})
