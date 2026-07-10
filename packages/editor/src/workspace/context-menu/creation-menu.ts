import { RESOURCE_TYPES } from '../items-persistence-contract'
import { Plus } from 'lucide-react'
import * as p from './predicates'
import * as selection from './selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import type { ContextMenuContributor, ContextMenuItemSpec } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '../sidebar/creation-catalog'

export interface WorkspaceCreationContextMenuActions {
  createNote: (context: WorkspaceMenuContext) => void
  createFolder: (context: WorkspaceMenuContext) => void
  createMap: (context: WorkspaceMenuContext) => void
  createCanvas: (context: WorkspaceMenuContext) => void
  createFile: (context: WorkspaceMenuContext) => void
}

export interface WorkspaceCreationContextMenuServices {
  actions: {
    creation: WorkspaceCreationContextMenuActions
  }
  canCreateItems: boolean
}

type WorkspaceContextMenuItem = ContextMenuItemSpec<
  WorkspaceMenuContext,
  WorkspaceCreationContextMenuServices
>
type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceCreationContextMenuServices
>
type SidebarItemCreationActionId = keyof WorkspaceCreationContextMenuActions

const sidebarItemCreationActionIds = {
  'create.note': 'createNote',
  'create.folder': 'createFolder',
  'create.map': 'createMap',
  'create.canvas': 'createCanvas',
  'create.file': 'createFile',
} satisfies Record<
  (typeof SIDEBAR_ITEM_CREATION_COMMANDS)[number]['id'],
  SidebarItemCreationActionId
>

const createSubmenuItems: Array<WorkspaceContextMenuItem> = SIDEBAR_ITEM_CREATION_COMMANDS.map(
  (command, index) => ({
    id: `submenu-create-${command.key}`,
    commandId: sidebarItemCreationActionIds[command.id],
    label: command.label,
    icon: command.icon,
    group: 'create',
    priority: index,
  }),
)

export const creationContextMenuCommands = {
  createNote: createActionCommand<
    WorkspaceMenuContext,
    { creation: WorkspaceCreationContextMenuActions }
  >('createNote', (actions, context) => actions.creation.createNote(context)),
  createFolder: createActionCommand<
    WorkspaceMenuContext,
    { creation: WorkspaceCreationContextMenuActions }
  >('createFolder', (actions, context) => actions.creation.createFolder(context)),
  createMap: createActionCommand<
    WorkspaceMenuContext,
    { creation: WorkspaceCreationContextMenuActions }
  >('createMap', (actions, context) => actions.creation.createMap(context)),
  createFile: createActionCommand<
    WorkspaceMenuContext,
    { creation: WorkspaceCreationContextMenuActions }
  >('createFile', (actions, context) => actions.creation.createFile(context)),
  createCanvas: createActionCommand<
    WorkspaceMenuContext,
    { creation: WorkspaceCreationContextMenuActions }
  >('createCanvas', (actions, context) => actions.creation.createCanvas(context)),
}

export const creationContextMenuContributors = [
  {
    id: 'editor-create',
    surfaces: ['sidebar', 'folder-view'],
    getItems: () => [
      {
        id: 'create-new-submenu',
        label: 'New...',
        icon: Plus,
        group: 'create',
        priority: 5,
        applies: (context, services) =>
          services.canCreateItems &&
          selection.hasFullAccess(context) &&
          (isFolderContext(context) || p.atRoot(context)),
        children: () => createSubmenuItems,
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>

function isFolderContext(context: WorkspaceMenuContext) {
  return context.item?.type === RESOURCE_TYPES.folders
}
