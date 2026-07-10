import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceCommand, ResourceCommandResult } from './transaction-contract'
import type { FileSystemCacheAdapter } from './cache'
import { createFileSystemClipboard, resolveFileSystemClipboardCommand } from './command-intents'
import { getFileSystemClipboard, setFileSystemClipboard, useFileSystemClipboard } from './clipboard'

type ExecuteFileSystemClipboardCommand = (
  command: ResourceCommand,
  options?: { onSuccess?: () => void },
) => Promise<ResourceCommandResult>

type FileSystemClipboardOperationsArgs = {
  workspaceId: string
  activeItemSurface: { parentId: SidebarItemId | null } | null
  cacheAdapter: FileSystemCacheAdapter
  executeCommand: ExecuteFileSystemClipboardCommand
}

export function useFileSystemClipboardOperations({
  workspaceId,
  activeItemSurface,
  cacheAdapter,
  executeCommand,
}: FileSystemClipboardOperationsArgs) {
  useFileSystemClipboard()

  const copy = (itemIds: Array<SidebarItemId>) => {
    setFileSystemClipboard(
      createFileSystemClipboard('copy', itemIds, workspaceId, cacheAdapter.getReadModel()),
    )
  }

  const cut = (itemIds: Array<SidebarItemId>) => {
    setFileSystemClipboard(
      createFileSystemClipboard('cut', itemIds, workspaceId, cacheAdapter.getReadModel()),
    )
  }

  const cancelClipboard = () => {
    if (!getFileSystemClipboard()) return false
    setFileSystemClipboard(null)
    return true
  }

  const paste = async (targetParentId?: SidebarItemId | null) => {
    const resolved = resolveFileSystemClipboardCommand({
      clipboard: getFileSystemClipboard(),
      workspaceId,
      activeItemSurface,
      targetParentId,
      readModel: cacheAdapter.getReadModel(),
    })
    if (!resolved.command) {
      if (resolved.clearClipboard) setFileSystemClipboard(null)
      return { status: 'unavailable' as const, reason: 'paste_unavailable' }
    }
    return executeCommand(resolved.command, {
      onSuccess: resolved.clearClipboard ? () => setFileSystemClipboard(null) : undefined,
    })
  }

  const canPaste = (targetParentId?: SidebarItemId | null) =>
    resolveFileSystemClipboardCommand({
      clipboard: getFileSystemClipboard(),
      workspaceId,
      activeItemSurface,
      targetParentId,
      readModel: cacheAdapter.getReadModel(),
    }).command !== null

  return {
    copy,
    cut,
    canUseClipboardOperations: true,
    cancelClipboard,
    canPaste,
    paste,
  }
}
