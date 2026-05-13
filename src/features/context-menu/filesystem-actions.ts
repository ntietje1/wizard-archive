import type { ActionHandlers } from './menu-registry'
import type { Folder } from 'convex/folders/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import type { FileSystemValue } from '~/features/filesystem/useFileSystem'
import { getContextMenuPasteParentId } from '~/features/filesystem/filesystem-targets'

type FilesystemActions = Pick<
  ActionHandlers,
  'delete' | 'restore' | 'permanentlyDelete' | 'paste' | 'duplicate'
>

export function createFilesystemActions({
  filesystem,
  parentItemsMap,
  setDeleteFolderDialog,
  onDialogOpen,
}: {
  filesystem: FileSystemValue
  parentItemsMap: ReadonlyMap<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  setDeleteFolderDialog: (folder: Folder) => void
  onDialogOpen?: () => void
}): FilesystemActions {
  return {
    delete: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return

      if (items.length === 1 && isFolder(items[0])) {
        const item = items[0]
        const children = parentItemsMap.get(item._id)
        if (children && children.length > 0) {
          setDeleteFolderDialog(item)
          onDialogOpen?.()
          return
        }
      }

      await filesystem.trashItems(items.map((item) => item._id))
    },

    restore: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      await filesystem.restoreItems(
        items.map((item) => item._id),
        null,
      )
    },

    permanentlyDelete: (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      if (filesystem.confirmDeleteForever(items.map((item) => item._id))) {
        onDialogOpen?.()
      }
    },

    paste: async (ctx) => {
      await filesystem.paste(
        getContextMenuPasteParentId({
          clickedItem: ctx.item,
          operationItems: ctx.selectedItems ?? [],
        }),
      )
    },
    duplicate: async (ctx) => {
      const items = ctx.selectedItems ?? []
      if (items.length === 0) return
      await filesystem.copyItems(
        items.map((item) => item._id),
        ctx.item?.parentId ?? null,
      )
    },
  }
}
