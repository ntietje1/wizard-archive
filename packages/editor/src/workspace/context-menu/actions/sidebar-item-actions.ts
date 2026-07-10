import { createWorkspaceResource } from '../../runtime'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { FileSystemItemContextMenuOperations } from '../../../filesystem/item-operation-contracts'
import type { WorkspaceMenuContext } from '../../menu-context'
import type { WorkspaceNavigation } from '../../runtime'
import { handleError } from '../../../errors/handle-error'
import type { WorkspaceSidebarItemContextMenuActions } from '../sidebar-item-menu'

type SidebarItemContextMenuActionsSource = {
  canOpenItemsSeparately: WorkspaceNavigation['canOpenItemsSeparately']
  openItem: WorkspaceNavigation['openItem']
  toggleBookmarks: FileSystemItemContextMenuOperations['toggleBookmarks']
}

export function createSidebarItemContextMenuActions({
  source,
  setRenamingItemId,
  showItemInSidebar,
}: {
  source: SidebarItemContextMenuActionsSource
  setRenamingItemId: (itemId: SidebarItemId | null) => void
  showItemInSidebar: (itemId: SidebarItemId) => void
}): WorkspaceSidebarItemContextMenuActions {
  return {
    canOpenInNewTab: source.canOpenItemsSeparately,
    open: async (context: WorkspaceMenuContext) => {
      if (!context.item) return
      try {
        await source.openItem(createWorkspaceResource(context.item.id))
      } catch (error) {
        handleError(error, 'Failed to open item')
      }
    },
    openInNewTab: async (context: WorkspaceMenuContext) => {
      if (!context.item) return
      if (source.canOpenItemsSeparately.status !== 'available') return
      try {
        await source.openItem(createWorkspaceResource(context.item.id), { target: 'separate' })
      } catch (error) {
        handleError(error, 'Failed to open item')
      }
    },
    rename: (context: WorkspaceMenuContext) => {
      if (!context.item) return
      showItemInSidebar(context.item.id)
      setRenamingItemId(context.item.id)
    },
    showInSidebar: (context: WorkspaceMenuContext) => {
      if (!context.item) return
      showItemInSidebar(context.item.id)
    },
    toggleBookmark: async (context: WorkspaceMenuContext) => {
      const item = context.item
      if (!item) return

      try {
        await source.toggleBookmarks([item.id])
      } catch (error) {
        handleError(error, 'Failed to toggle bookmark')
      }
    },
  }
}
