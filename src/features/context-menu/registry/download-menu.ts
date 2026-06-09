import { Download, FolderDown } from 'lucide-react'
import * as p from '../predicates'
import { createActionCommand } from './command'
import type { ContextMenuContributor, EditorContextMenuServices, EditorMenuContext } from '../types'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

export const downloadContextMenuCommands = {
  downloadItems: createActionCommand('downloadItems', (actions, context) =>
    actions.download.downloadItems(context),
  ),
  downloadAll: createActionCommand('downloadAll', (actions, context) =>
    actions.download.downloadAll(context),
  ),
}

export const downloadContextMenuContributors = [
  {
    id: 'editor-download',
    surfaces: ['sidebar', 'folder-view', 'topbar', 'map-view'],
    getItems: () => [
      {
        id: 'download-items',
        commandId: 'downloadItems',
        label: (context) => {
          const itemCount = context.selectedItems?.length ?? 0
          return itemCount > 1 ? `Download ${itemCount} items` : 'Download'
        },
        icon: Download,
        group: 'download',
        priority: 80,
        applies: (context) =>
          p.allSelectedItemsHaveViewAccess(context) &&
          p.isSidebarItem(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          !p.hasPinContext(context),
      },
      {
        id: 'download-all',
        commandId: 'downloadAll',
        label: 'Download All',
        icon: FolderDown,
        group: 'download',
        priority: 82,
        applies: (context) => p.atRoot(context) && p.inSidebar(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
