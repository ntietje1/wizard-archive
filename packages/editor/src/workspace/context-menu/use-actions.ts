import { toast } from 'sonner'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import type { ResourceCatalog } from '../../filesystem/catalog'
import type { FileSystemItemContextMenuOperations } from '../../filesystem/item-operation-contracts'
import type { FileSystemDownload } from '../../filesystem/download'
import type { ResourceShareSource, ShareActionResult } from '../../sharing/contracts'
import type { WorkspaceMenuContext } from '../menu-context'
import type { WorkspaceSharingContextMenuActions } from './sharing-menu'
import { handleError } from '../../errors/handle-error'
import { useSidebarWorkspaceState } from '../sidebar/workspace-state'
import { useRevealSidebarItemParents } from '../sidebar/use-reveal-item-parents'

import { createDownloadActions } from './actions/download-actions'
import { createCreationActions } from './actions/creation-actions'
import { createFilesystemContextMenuActions } from './filesystem-actions'
import type { FilesystemContextMenuActionTarget } from './filesystem-actions'
import type { WorkspaceNavigation } from '../runtime'
import { createSidebarItemContextMenuActions } from './actions/sidebar-item-actions'

type WorkspaceContextMenuActionsSource = {
  catalog: Pick<ResourceCatalog, 'getVisibleAncestors' | 'getVisibleChildren'>
  canOpenItemsSeparately: WorkspaceNavigation['canOpenItemsSeparately']
  createItem: FileSystemItemContextMenuOperations['createItem']
  download: FileSystemDownload
  openItem: WorkspaceNavigation['openItem']
  sharing: ResourceShareSource
  toggleBookmarks: FileSystemItemContextMenuOperations['toggleBookmarks']
}

interface UseWorkspaceContextMenuActionsOptions {
  filesystem: FilesystemContextMenuActionTarget
  onDialogOpen?: () => void
  source: WorkspaceContextMenuActionsSource
}

export function useWorkspaceContextMenuActions(options: UseWorkspaceContextMenuActionsOptions) {
  const { filesystem, onDialogOpen, source } = options
  const {
    editing: { setRenamingItemId },
  } = useSidebarWorkspaceState()
  const revealSidebarItemParents = useRevealSidebarItemParents(source.catalog)
  const downloadActions = createDownloadActions({
    dataSource: source.download,
  })
  const creationActions = createCreationActions({
    createItem: source.createItem,
    openItem: source.openItem,
    setRenamingItemId,
  })

  const sidebarItemActions = createSidebarItemContextMenuActions({
    source: {
      canOpenItemsSeparately: source.canOpenItemsSeparately,
      openItem: source.openItem,
      toggleBookmarks: source.toggleBookmarks,
    },
    setRenamingItemId,
    showItemInSidebar: revealSidebarItemParents,
  })

  const sharingActions: WorkspaceSharingContextMenuActions = {
    setGeneralAccessLevel: async (ctx: WorkspaceMenuContext, level: PermissionLevel | null) => {
      const items = ctx.selectedItems
      if (items.length === 0) return
      if (source.sharing.status !== 'available') return
      const target = items.length === 1 ? 'item' : `${items.length} items`
      const errorMessage = `Failed to update access level for ${target}`

      try {
        const result = await source.sharing.setDefaultPermission(items, level)
        if (result.status !== 'completed') {
          reportShareActionFailure(result, errorMessage)
          return
        }
        if (level === null) {
          toast.success(`Access reset to default for ${target}`)
        } else if (level === PERMISSION_LEVEL.NONE) {
          toast.success(`Access set to none for ${target}`)
        } else {
          toast.success(`Access set to ${level} for ${target}`)
        }
      } catch (error) {
        handleError(error, errorMessage)
      }
    },
  }

  const filesystemContextMenuActions = createFilesystemContextMenuActions({
    filesystem,
    onDialogOpen,
  })

  return {
    sidebarItem: sidebarItemActions,
    creation: creationActions,
    sharing: sharingActions,
    download: downloadActions,
    filesystem: filesystemContextMenuActions,
  }
}

export function reportShareActionFailure(
  result: Exclude<ShareActionResult, { status: 'completed' }>,
  message: string,
) {
  if (result.status === 'failed' && result.error) {
    handleError(result.error, message)
    return
  }
  toast.error(message)
}
