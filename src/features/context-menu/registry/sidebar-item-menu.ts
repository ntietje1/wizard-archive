import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import {
  Bookmark,
  Eye,
  FileEdit,
  FileTypeIcon,
  Navigation,
  RotateCcw,
  SquareArrowOutUpRight,
} from 'lucide-react'
import * as p from '../predicates'
import { createActionCommand } from './command'
import type { ContextMenuContributor, EditorContextMenuServices, EditorMenuContext } from '../types'
import { assertNever } from '~/shared/utils/utils'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

function getTypeName(context: EditorMenuContext): string {
  if (!context.item) return 'Item'

  switch (context.item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    case SIDEBAR_ITEM_TYPES.canvases:
      return 'Canvas'
    default:
      return assertNever(context.item)
  }
}

export const sidebarItemContextMenuCommands = {
  open: createActionCommand('open', (actions, context) => actions.sidebarItem.open(context)),
  rename: createActionCommand('rename', (actions, context) => actions.sidebarItem.rename(context)),
  showInSidebar: createActionCommand('showInSidebar', (actions, context) =>
    actions.sidebarItem.showInSidebar(context),
  ),
  editMap: createActionCommand('editMap', (actions, context) =>
    actions.sidebarItem.editMap(context),
  ),
  editFile: createActionCommand('editFile', (actions, context) =>
    actions.sidebarItem.editFile(context),
  ),
  editItem: createActionCommand('editItem', (actions, context) =>
    actions.sidebarItem.editItem(context),
  ),
  toggleBookmark: createActionCommand('toggleBookmark', (actions, context) =>
    actions.sidebarItem.toggleBookmark(context),
  ),
}

export const sidebarItemContextMenuContributors = [
  {
    id: 'editor-primary',
    surfaces: ['sidebar', 'topbar', 'folder-view', 'map-view', 'trash-view', 'note-view'],
    getItems: () => [
      {
        id: 'open',
        commandId: 'open',
        label: 'Open',
        icon: SquareArrowOutUpRight,
        group: 'primary',
        priority: 0,
        applies: (context) =>
          p.isSingleSelection(context) &&
          (p.inSidebar(context) || p.hasPinContext(context)) &&
          context.item !== undefined,
      },
      {
        id: 'go-to-map-pin',
        commandId: 'goToMapPin',
        label: 'Go to Map Pin',
        icon: Navigation,
        group: 'primary',
        priority: 1,
        applies: (context) =>
          p.inSidebar(context) &&
          p.isSidebarItem(context) &&
          p.isPinnedOnActiveMap(context) &&
          p.isNotActiveMap(context),
      },
      {
        id: 'toggle-bookmark',
        commandId: 'toggleBookmark',
        label: (context) => (context.item?.isBookmarked ? 'Remove Bookmark' : 'Bookmark'),
        icon: Bookmark,
        group: 'primary',
        priority: 2,
        applies: (context) =>
          p.inView('sidebar', 'folder-view')(context) && p.isSidebarItem(context),
        isChecked: (context) => context.item?.isBookmarked ?? false,
      },
      {
        id: 'show-in-sidebar',
        commandId: 'showInSidebar',
        label: 'Show in Sidebar',
        icon: Eye,
        group: 'primary',
        priority: 3,
        applies: (context) => p.isSidebarItem(context) && p.isNotActiveMap(context),
      },
      {
        id: 'restore',
        commandId: 'restore',
        label: 'Restore',
        icon: RotateCcw,
        group: 'primary',
        priority: 4,
        applies: (context) => p.canRestoreSelectedItems(context) && p.isSidebarItem(context),
      },
    ],
  },
  {
    id: 'editor-edit',
    surfaces: ['sidebar', 'folder-view', 'topbar'],
    getItems: () => [
      {
        id: 'rename',
        commandId: 'rename',
        label: 'Rename',
        icon: FileTypeIcon,
        group: 'edit',
        priority: 90,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.inSidebar(context) &&
          p.isItemNotTrashed(context) &&
          p.isSidebarItem(context),
      },
      {
        id: 'edit-map',
        commandId: 'editMap',
        label: 'Edit Map',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isItemNotTrashed(context) &&
          p.isType(SIDEBAR_ITEM_TYPES.gameMaps)(context),
      },
      {
        id: 'edit-file',
        commandId: 'editFile',
        label: 'Edit File',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isItemNotTrashed(context) &&
          p.isType(SIDEBAR_ITEM_TYPES.files)(context),
      },
      {
        id: 'edit-item',
        commandId: 'editItem',
        label: (context) => `Edit ${getTypeName(context)}`,
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          p.isSingleSelection(context) &&
          p.hasFullAccess(context) &&
          p.isSidebarItem(context) &&
          p.isItemNotTrashed(context) &&
          p.isNotType(SIDEBAR_ITEM_TYPES.gameMaps, SIDEBAR_ITEM_TYPES.files)(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
