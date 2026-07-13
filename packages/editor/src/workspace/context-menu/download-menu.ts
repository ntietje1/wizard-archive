import { Download, FolderDown } from 'lucide-react'
import * as p from './predicates'
import * as selection from './selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import type { ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'
import { VIEW_CONTEXT } from '../view-context'

type WorkspaceDownloadActionResult =
  | { status: 'completed' }
  | { status: 'unsupported'; reason: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; error?: unknown }

export interface WorkspaceDownloadContextMenuActions {
  downloadItems: (context: WorkspaceMenuContext) => Promise<WorkspaceDownloadActionResult>
  downloadAll: (context: WorkspaceMenuContext) => Promise<WorkspaceDownloadActionResult>
}

export interface WorkspaceDownloadContextMenuServices {
  actions: {
    download: WorkspaceDownloadContextMenuActions
  }
}

type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceDownloadContextMenuServices
>

export const downloadContextMenuCommands = {
  downloadItems: createActionCommand<
    WorkspaceMenuContext,
    { download: WorkspaceDownloadContextMenuActions }
  >('downloadItems', (actions, context) => actions.download.downloadItems(context)),
  downloadAll: createActionCommand<
    WorkspaceMenuContext,
    { download: WorkspaceDownloadContextMenuActions }
  >('downloadAll', (actions, context) => actions.download.downloadAll(context)),
}

export const downloadContextMenuContributors = [
  {
    id: 'editor-download',
    surfaces: [
      VIEW_CONTEXT.SIDEBAR,
      VIEW_CONTEXT.FOLDER_VIEW,
      VIEW_CONTEXT.TOPBAR,
      VIEW_CONTEXT.MAP_VIEW,
    ],
    getItems: () => [
      {
        id: 'download-items',
        commandId: 'downloadItems',
        label: (context) => {
          const itemCount = context.selectedItems.length
          return itemCount > 1 ? `Download ${itemCount} items` : 'Download'
        },
        icon: Download,
        group: 'download',
        priority: 80,
        applies: (context) =>
          selection.allSelectedItemsHaveViewAccess(context) &&
          p.isSidebarItem(context) &&
          selection.allSelectedItemsNotTrashed(context),
      },
      {
        id: 'download-all',
        commandId: 'downloadAll',
        label: 'Download All',
        icon: FolderDown,
        group: 'download',
        priority: 82,
        applies: (context) =>
          p.atRoot(context) &&
          p.inSidebar(context) &&
          context.rootOperations?.canDownloadAll === true,
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>
