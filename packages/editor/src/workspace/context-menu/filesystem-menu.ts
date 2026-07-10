import { ClipboardPaste, Files, RotateCcw, Trash2 } from 'lucide-react'
import * as p from './predicates'
import * as selection from './selection'
import { createActionCommand } from '../../context-menu/create-action-command'
import type { ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../menu-context'
import type {
  FilesystemContextMenuActionTarget,
  WorkspaceFilesystemContextMenuActions,
} from './filesystem-actions'

export interface WorkspaceFilesystemContextMenuServices {
  actions: {
    filesystem: WorkspaceFilesystemContextMenuActions
  }
  filesystem: Pick<
    FilesystemContextMenuActionTarget,
    | 'canPasteIntoTarget'
    | 'canDuplicateItems'
    | 'canTrashItems'
    | 'canRestoreItems'
    | 'canDeleteItemsForever'
    | 'canEmptyTrash'
  >
}

type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceFilesystemContextMenuServices
>

export const filesystemContextMenuCommands = {
  delete: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('delete', (actions, context) => actions.filesystem.delete(context)),
  paste: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('paste', (actions, context) => actions.filesystem.paste(context)),
  duplicate: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('duplicate', (actions, context) => actions.filesystem.duplicate(context)),
  restore: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('restore', (actions, context) => actions.filesystem.restore(context)),
  permanentlyDelete: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('permanentlyDelete', (actions, context) => actions.filesystem.permanentlyDelete(context)),
  emptyTrash: createActionCommand<
    WorkspaceMenuContext,
    { filesystem: WorkspaceFilesystemContextMenuActions }
  >('emptyTrash', (actions, context) => actions.filesystem.emptyTrash(context)),
}

export const filesystemContextMenuContributors = [
  {
    id: 'editor-clipboard',
    surfaces: ['sidebar', 'folder-view'],
    getItems: () => [
      {
        id: 'paste',
        commandId: 'paste',
        label: 'Paste',
        icon: ClipboardPaste,
        group: 'edit',
        priority: 87,
        applies: (context, services) =>
          p.inView('sidebar', 'folder-view')(context) &&
          services.filesystem.canPasteIntoTarget({
            clickedItem: context.item,
          }),
      },
      {
        id: 'duplicate',
        commandId: 'duplicate',
        label: 'Duplicate',
        icon: Files,
        group: 'edit',
        priority: 88,
        applies: (context, services) =>
          selection.hasSelection(context) &&
          services.filesystem.canDuplicateItems(context.selectedItems),
      },
    ],
  },
  {
    id: 'editor-danger',
    surfaces: ['sidebar', 'folder-view', 'topbar', 'trash-view'],
    getItems: () => [
      {
        id: 'restore',
        commandId: 'restore',
        label: 'Restore',
        icon: RotateCcw,
        group: 'primary',
        priority: 4,
        applies: (context, services) =>
          services.filesystem.canRestoreItems(context.selectedItems) && p.isSidebarItem(context),
      },
      {
        id: 'delete',
        commandId: 'delete',
        label: 'Move to Trash',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context, services) =>
          services.filesystem.canTrashItems(context.selectedItems) &&
          p.isSidebarItem(context) &&
          p.inView('sidebar', 'folder-view', 'topbar')(context),
      },
      {
        id: 'permanently-delete',
        commandId: 'permanentlyDelete',
        label: 'Delete Forever',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context, services) =>
          services.filesystem.canDeleteItemsForever(context.selectedItems) &&
          p.isSidebarItem(context),
      },
    ],
  },
  {
    id: 'editor-trash',
    surfaces: ['trash-view'],
    getItems: () => [
      {
        id: 'empty-trash',
        commandId: 'emptyTrash',
        label: 'Empty Trash',
        icon: Trash2,
        group: 'danger',
        priority: 101,
        variant: 'danger',
        applies: (_context, services) => services.filesystem.canEmptyTrash,
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>
