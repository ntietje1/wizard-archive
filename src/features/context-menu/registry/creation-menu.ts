import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { Plus } from 'lucide-react'
import * as p from '../predicates'
import { createActionCommand } from './command'
import type {
  ContextMenuContributor,
  ContextMenuItemSpec,
  EditorContextMenuServices,
  EditorCreationContextMenuActions,
  EditorMenuContext,
} from '../types'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'

type EditorContextMenuItem = ContextMenuItemSpec<EditorMenuContext, EditorContextMenuServices>
type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>
type SidebarItemCreationActionId = keyof EditorCreationContextMenuActions

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

const createSubmenuItems: Array<EditorContextMenuItem> = SIDEBAR_ITEM_CREATION_COMMANDS.map(
  (command) => ({
    id: `submenu-create-${command.key}`,
    commandId: sidebarItemCreationActionIds[command.id],
    label: command.label,
    icon: command.icon,
    group: 'create',
    priority: command.priority,
  }),
)

export const creationContextMenuCommands = {
  createNote: createActionCommand('createNote', (actions, context) =>
    actions.creation.createNote(context),
  ),
  createFolder: createActionCommand('createFolder', (actions, context) =>
    actions.creation.createFolder(context),
  ),
  createMap: createActionCommand('createMap', (actions, context) =>
    actions.creation.createMap(context),
  ),
  createFile: createActionCommand('createFile', (actions, context) =>
    actions.creation.createFile(context),
  ),
  createCanvas: createActionCommand('createCanvas', (actions, context) =>
    actions.creation.createCanvas(context),
  ),
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
        applies: (context) =>
          p.hasFullAccess(context) &&
          !p.hasPinContext(context) &&
          (p.isType(SIDEBAR_ITEM_TYPES.folders)(context) || p.atRoot(context)),
        children: () => createSubmenuItems,
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
