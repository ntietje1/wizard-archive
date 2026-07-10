import type { WorkspaceMenuContext } from '../menu-context'
import type { AnyItem } from '../items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { FileSystemPasteTargetInput } from '../../filesystem/item-operation-contracts'
import type { ResourceCommandResult } from '../../filesystem/transaction-contract'
import { handleError } from '../../errors/handle-error'

export interface FilesystemContextMenuActionTarget {
  canDeleteItemsForever: (items: Array<AnyItem>) => boolean
  canDuplicateItems: (items: Array<AnyItem>) => boolean
  canEmptyTrash: boolean
  canPasteIntoTarget: (input: FileSystemPasteTargetInput) => boolean
  canRestoreItems: (items: Array<AnyItem>) => boolean
  canTrashItems: (items: Array<AnyItem>) => boolean
  duplicateItems: (items: Array<AnyItem>) => MaybePromise<void>
  requestEmptyTrash: () => MaybePromise<void>
  pasteIntoTarget: (input: FileSystemPasteTargetInput) => MaybePromise<ResourceCommandResult>
  requestDeleteItemsForever: (items: Array<AnyItem>) => MaybePromise<void>
  restoreItems: (items: Array<AnyItem>, targetParentId: SidebarItemId | null) => MaybePromise<void>
  trashItems: (items: Array<AnyItem>) => MaybePromise<void>
}

export interface WorkspaceFilesystemContextMenuActions {
  delete: (context: WorkspaceMenuContext) => void | Promise<void>
  paste: (context: WorkspaceMenuContext) => void | Promise<void>
  duplicate: (context: WorkspaceMenuContext) => void | Promise<void>
  restore: (context: WorkspaceMenuContext) => void | Promise<void>
  permanentlyDelete: (context: WorkspaceMenuContext) => void | Promise<void>
  emptyTrash: (context: WorkspaceMenuContext) => void | Promise<void>
}

export function createFilesystemContextMenuActions({
  filesystem,
  onDialogOpen,
}: {
  filesystem: FilesystemContextMenuActionTarget
  onDialogOpen?: () => void
}): WorkspaceFilesystemContextMenuActions {
  return {
    delete: async (context) => {
      const items = getSelectedItems(context)
      if (items.length > 0) {
        await runFilesystemAction(
          () => filesystem.trashItems(items),
          'Failed to move items to trash',
        )
      }
    },

    duplicate: async (context) => {
      const items = getSelectedItems(context)
      if (items.length > 0) {
        await runFilesystemAction(
          () => filesystem.duplicateItems(items),
          'Failed to duplicate items',
        )
      }
    },

    emptyTrash: async () => {
      await runFilesystemAction(async () => {
        await filesystem.requestEmptyTrash()
        onDialogOpen?.()
      }, 'Failed to empty trash')
    },

    paste: async (context) => {
      await runFilesystemAction(
        () =>
          filesystem.pasteIntoTarget({
            clickedItem: context.item,
          }),
        'Failed to paste items',
      )
    },

    permanentlyDelete: async (context) => {
      const items = getSelectedItems(context)
      if (items.length > 0) {
        await runFilesystemAction(
          () => filesystem.requestDeleteItemsForever(items),
          'Failed to permanently delete items',
        )
      }
    },

    restore: async (context) => {
      const items = getSelectedItems(context)
      if (items.length > 0) {
        await runFilesystemAction(
          () => filesystem.restoreItems(items, null),
          'Failed to restore items',
        )
      }
    },
  }
}

async function runFilesystemAction(action: () => MaybePromise<unknown>, fallbackMessage: string) {
  try {
    await action()
  } catch (error) {
    handleError(error, fallbackMessage)
  }
}

function getSelectedItems(context: WorkspaceMenuContext) {
  return context.selectedItems
}
