import { toast } from 'sonner'
import type { ActionHandlers } from './menu-registry'
import type { MenuContext } from './types'
import { resolveContextOperationItems } from './selection-context'
import type { Folder } from 'convex/folders/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemOperationsValue } from '~/features/sidebar/operations/useSidebarItemOperations'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { handleError } from '~/shared/utils/logger'

type FilesystemActions = Pick<
  ActionHandlers,
  'delete' | 'restore' | 'permanentlyDelete' | 'copy' | 'cut' | 'paste' | 'duplicate'
>

export function createFilesystemActions({
  itemOperations,
  parentItemsMap,
  setDeleteFolderDialog,
  onDialogOpen,
}: {
  itemOperations: SidebarItemOperationsValue
  parentItemsMap: ReadonlyMap<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  setDeleteFolderDialog: (folder: Folder) => void
  onDialogOpen?: () => void
}): FilesystemActions {
  const normalizedContextItems = (ctx: MenuContext) =>
    itemOperations.normalizeItems(resolveContextOperationItems(ctx))

  return {
    delete: async (ctx) => {
      const items = normalizedContextItems(ctx)
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

      try {
        await itemOperations.trashItems(items)
      } catch (error) {
        handleError(
          error,
          items.length === 1 ? 'Failed to move item to trash' : 'Failed to move items to trash',
        )
      }
    },

    restore: async (ctx) => {
      const items = normalizedContextItems(ctx)
      if (items.length === 0) return
      try {
        const movedIds = await itemOperations.restoreItems(items)
        if (movedIds.length === 0) {
          toast.info('No items restored')
        } else {
          toast.success(
            movedIds.length === 1 ? 'Item restored' : `${movedIds.length} items restored`,
          )
        }
      } catch (error) {
        handleError(
          error,
          items.length === 1 ? 'Failed to restore item' : 'Failed to restore items',
        )
      }
    },

    permanentlyDelete: (ctx) => {
      const items = normalizedContextItems(ctx)
      if (items.length === 0) return
      if (itemOperations.confirmPermanentDeleteItems(items)) {
        onDialogOpen?.()
      }
    },

    copy: (ctx) => itemOperations.copyItems(normalizedContextItems(ctx)),
    cut: (ctx) => itemOperations.cutItems(normalizedContextItems(ctx)),
    paste: async (ctx) => {
      const targetParentId = ctx.item && isFolder(ctx.item) ? ctx.item._id : undefined
      try {
        await itemOperations.pasteClipboard(targetParentId)
      } catch (error) {
        handleError(error, 'Failed to paste items')
      }
    },
    duplicate: async (ctx) => {
      const items = normalizedContextItems(ctx)
      const targetParentId = ctx.item?.parentId ?? null
      try {
        await itemOperations.duplicateItems(items, targetParentId)
      } catch (error) {
        handleError(
          error,
          items.length === 1 ? 'Failed to duplicate item' : 'Failed to duplicate items',
        )
      }
    },
  }
}
