import type { RefObject } from 'react'
import { createWorkspaceResource } from './runtime'
import type { WorkspaceRuntime } from './runtime'
import type { HotkeyFileSystemActions } from './sidebar/use-item-surface-hotkeys'
import { useItemSurfaceHotkeys } from './sidebar/use-item-surface-hotkeys'
import { canRenameSidebarItem, getSidebarFilesystemCapabilities } from '../filesystem/capabilities'
import { projectFileSystemActionItem } from '../filesystem/action-item'
import type { AnyItem } from './items'

export function WorkspaceRuntimeItemSurfaceHotkeys({
  runtime,
  scopeRef,
}: {
  runtime: WorkspaceRuntime
  scopeRef?: RefObject<HTMLElement | null>
}) {
  const { catalog, operationItems, operations, permissions } = runtime.filesystem
  const actor = {
    canCreateRootItems: permissions.canCreateItems,
    canManageFolders: permissions.canManageFolders,
  }
  const projectItems = (items: Array<AnyItem>) =>
    items.map((item) => projectFileSystemActionItem(item, permissions))
  const hotkeyFileSystem: HotkeyFileSystemActions = {
    cancelClipboard: () =>
      operations.clipboard.status === 'available' ? operations.clipboard.cancel() : false,
    copy: (itemIds) => {
      if (operations.clipboard.status === 'available') operations.clipboard.copyItems(itemIds)
    },
    cut: (itemIds) => {
      if (operations.clipboard.status === 'available') operations.clipboard.cutItems(itemIds)
    },
    canUseClipboardOperations: operations.clipboard.status === 'available',
    canPaste: operations.clipboard.status === 'available' ? operations.clipboard.canPaste : false,
    canDeleteItemsForever: (items) =>
      getSidebarFilesystemCapabilities(actor, projectItems(items)).canDeleteForever,
    canRenameItem: (item) => canRenameSidebarItem(projectFileSystemActionItem(item, permissions)),
    canTrashItems: (items) => getSidebarFilesystemCapabilities(actor, projectItems(items)).canTrash,
    paste: (targetParentId) => {
      if (operations.clipboard.status !== 'available') {
        return { status: 'unavailable', reason: 'clipboard_unavailable' }
      }
      return operations.clipboard.paste(targetParentId)
    },
    confirmDeleteForever: operations.requestDeleteItemsForever,
    getVisibleAncestors: catalog.getVisibleAncestors,
    openItem: (itemId) => runtime.navigation.openItem(createWorkspaceResource(itemId)),
    requestTrashItems: operations.trashItems,
    resolveOperationItems: operationItems.resolveItems,
  }
  useItemSurfaceHotkeys(hotkeyFileSystem, { scopeRef })
  return null
}
