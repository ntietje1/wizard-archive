import { RESOURCE_TYPES } from '../items-persistence-contract'
import { FileEdit } from 'lucide-react'
import * as p from './predicates'
import * as selection from './selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import type { ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'

interface WorkspaceItemEditContextMenuActions {
  editMap: (context: WorkspaceMenuContext) => void
  editFile: (context: WorkspaceMenuContext) => void
  editItem: (context: WorkspaceMenuContext) => void
}

export interface WorkspaceItemEditContextMenuServices {
  actions: {
    itemEdit: WorkspaceItemEditContextMenuActions
  }
}

type WorkspaceItemEditContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceItemEditContextMenuServices
>

function getTypeName(context: WorkspaceMenuContext): string {
  if (!context.item) return 'Item'
  const itemType = context.item.type

  switch (itemType) {
    case RESOURCE_TYPES.notes:
      return 'Note'
    case RESOURCE_TYPES.folders:
      return 'Folder'
    case RESOURCE_TYPES.gameMaps:
      return 'Map'
    case RESOURCE_TYPES.files:
      return 'File'
    case RESOURCE_TYPES.canvases:
      return 'Canvas'
    default:
      return itemType satisfies never
  }
}

export const workspaceItemEditContextMenuCommands = {
  editMap: createActionCommand<
    WorkspaceMenuContext,
    { itemEdit: WorkspaceItemEditContextMenuActions }
  >('editMap', (actions, context) => actions.itemEdit.editMap(context)),
  editFile: createActionCommand<
    WorkspaceMenuContext,
    { itemEdit: WorkspaceItemEditContextMenuActions }
  >('editFile', (actions, context) => actions.itemEdit.editFile(context)),
  editItem: createActionCommand<
    WorkspaceMenuContext,
    { itemEdit: WorkspaceItemEditContextMenuActions }
  >('editItem', (actions, context) => actions.itemEdit.editItem(context)),
}

export const workspaceItemEditContextMenuContributors = [
  {
    id: 'workspace-item-edit',
    surfaces: ['sidebar', 'folder-view', 'topbar'],
    getItems: () => [
      {
        id: 'edit-map',
        commandId: 'editMap',
        label: 'Edit Map',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          selection.isSingleSelection(context) &&
          selection.hasEditAccess(context) &&
          selection.isItemNotTrashed(context) &&
          isItemType(context, RESOURCE_TYPES.gameMaps),
      },
      {
        id: 'edit-file',
        commandId: 'editFile',
        label: 'Edit File',
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          selection.isSingleSelection(context) &&
          selection.hasEditAccess(context) &&
          selection.isItemNotTrashed(context) &&
          isItemType(context, RESOURCE_TYPES.files),
      },
      {
        id: 'edit-item',
        commandId: 'editItem',
        label: (context) => `Edit ${getTypeName(context)}`,
        icon: FileEdit,
        group: 'edit',
        priority: 99,
        applies: (context) =>
          selection.isSingleSelection(context) &&
          selection.hasEditAccess(context) &&
          p.isSidebarItem(context) &&
          selection.isItemNotTrashed(context) &&
          !isItemType(context, RESOURCE_TYPES.gameMaps, RESOURCE_TYPES.files),
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceItemEditContextMenuContributor>

function isItemType(
  context: WorkspaceMenuContext,
  ...types: Array<(typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES]>
) {
  return context.item ? types.includes(context.item.type) : false
}
