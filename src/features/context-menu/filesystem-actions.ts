import type { ActionHandlers } from './menu-registry'
import type { FileSystemValue } from '~/features/filesystem/useFileSystem'
import { getContextMenuPasteParentId } from '~/features/filesystem/filesystem-targets'

type FilesystemActions = Pick<
  ActionHandlers,
  'delete' | 'restore' | 'permanentlyDelete' | 'paste' | 'duplicate'
>

const RESTORE_TO_ORIGINAL_LOCATION = null

export function createFilesystemActions({
  filesystem,
}: {
  filesystem: Pick<
    FileSystemValue,
    'requestTrashItems' | 'restoreItems' | 'confirmDeleteForever' | 'paste' | 'duplicateItems'
  >
}): FilesystemActions {
  return {
    delete: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return

      await filesystem.requestTrashItems(items.map((item) => item._id))
    },

    restore: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      await filesystem.restoreItems(
        items.map((item) => item._id),
        RESTORE_TO_ORIGINAL_LOCATION,
      )
    },

    permanentlyDelete: (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      // This only opens the provider-owned confirmation dialog; deletion starts from that dialog.
      filesystem.confirmDeleteForever(items.map((item) => item._id))
    },

    paste: async (ctx) => {
      const parentId = getContextMenuPasteParentId({
        clickedItem: ctx.item,
        operationItems: ctx.selectedItems ?? [],
      })
      await filesystem.paste(parentId)
    },
    duplicate: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      await filesystem.duplicateItems(items.map((item) => item._id))
    },
  }
}
