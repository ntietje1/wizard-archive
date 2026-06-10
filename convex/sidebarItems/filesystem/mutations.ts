import { v } from 'convex/values'
import { campaignMutation } from '../../functions'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { FILE_SYSTEM_COMMAND_TYPE } from '../../../shared/sidebar-items/filesystem/commands'
import { executeCreateCommand } from './commandModules/create'
import { executeRenameCommand } from './commandModules/rename'
import { executeCopyCommand } from './commandModules/copy'
import { executeMoveCommand } from './commandModules/move'
import { executeDeleteForeverCommand } from './commandModules/deleteForever'
import { executeEmptyTrashCommand } from './commandModules/emptyTrash'
import { executeShareCommand } from './commandModules/share'
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
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type {
  FileSystemCommand,
  FileSystemOperationDecision,
} from '../../../shared/sidebar-items/filesystem/commands'
import type {
  FileSystemDelta,
  FileSystemTransactionReceipt,
} from '../../../shared/sidebar-items/filesystem/receipts'

const MAX_FILE_SYSTEM_COMMAND_ITEMS = 100

function commandItemIds(command: FileSystemCommand): Array<Id<'sidebarItems'>> {
  switch (command.type) {
    case FILE_SYSTEM_COMMAND_TYPE.move:
    case FILE_SYSTEM_COMMAND_TYPE.restore:
    case FILE_SYSTEM_COMMAND_TYPE.copy:
    case FILE_SYSTEM_COMMAND_TYPE.trash:
    case FILE_SYSTEM_COMMAND_TYPE.deleteForever:
    case FILE_SYSTEM_COMMAND_TYPE.setAllPlayersPermission:
    case FILE_SYSTEM_COMMAND_TYPE.setSidebarItemsMemberPermission:
    case FILE_SYSTEM_COMMAND_TYPE.clearSidebarItemsMemberPermission:
      return command.itemIds
    case FILE_SYSTEM_COMMAND_TYPE.create:
    case FILE_SYSTEM_COMMAND_TYPE.rename:
    case FILE_SYSTEM_COMMAND_TYPE.emptyTrash:
    case FILE_SYSTEM_COMMAND_TYPE.setFolderInheritShares:
      return []
  }
}

function assertCommandSize(command: FileSystemCommand) {
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
    command: FileSystemCommand
    decisions?: Array<FileSystemOperationDecision>
  },
): Promise<FileSystemDelta> {
  assertCommandSize(command)

  switch (command.type) {
    case FILE_SYSTEM_COMMAND_TYPE.create:
      return await executeCreateCommand(ctx, { command })
    case FILE_SYSTEM_COMMAND_TYPE.rename:
      return await executeRenameCommand(ctx, { command })
    case FILE_SYSTEM_COMMAND_TYPE.copy:
      return await executeCopyCommand(ctx, { command, decisions })
    case FILE_SYSTEM_COMMAND_TYPE.move:
      return await executeMoveCommand(ctx, { command, action: 'move', decisions })
    case FILE_SYSTEM_COMMAND_TYPE.restore:
      return await executeMoveCommand(ctx, {
        command,
        action: 'restore',
        decisions,
      })
    case FILE_SYSTEM_COMMAND_TYPE.trash:
      return await executeMoveCommand(ctx, { command, action: 'trash', decisions })
    case FILE_SYSTEM_COMMAND_TYPE.deleteForever:
      return await executeDeleteForeverCommand(ctx, { command })
    case FILE_SYSTEM_COMMAND_TYPE.emptyTrash:
      return await executeEmptyTrashCommand(ctx, { command })
    case FILE_SYSTEM_COMMAND_TYPE.setAllPlayersPermission:
    case FILE_SYSTEM_COMMAND_TYPE.setSidebarItemsMemberPermission:
    case FILE_SYSTEM_COMMAND_TYPE.clearSidebarItemsMemberPermission:
    case FILE_SYSTEM_COMMAND_TYPE.setFolderInheritShares:
      return await executeShareCommand(ctx, { command })
  }
}

export const executeFileSystemCommand = campaignMutation({
  args: {
    command: fileSystemCommandValidator,
    decisions: v.optional(v.array(fileSystemOperationDecisionValidator)),
    clientOperationId: v.optional(v.string()),
  },
  returns: fileSystemTransactionReceiptValidator,
  handler: async (ctx, args): Promise<FileSystemTransactionReceipt> => {
    const command = args.command as FileSystemCommand
    const decisions = args.decisions as Array<FileSystemOperationDecision> | undefined
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
  handler: async (ctx, args): Promise<FileSystemTransactionReceipt> => {
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
  handler: async (ctx, args): Promise<FileSystemTransactionReceipt> => {
    return await applyFilesystemTransactionDirection(ctx, {
      transactionId: args.transactionId,
      direction: 'redo',
    })
  },
})
