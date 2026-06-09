import { ClipboardPaste, Files, Trash2 } from 'lucide-react'
import * as p from '../predicates'
import { createActionCommand } from './command'
import type { ContextMenuContributor, EditorContextMenuServices, EditorMenuContext } from '../types'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

export const filesystemContextMenuCommands = {
  delete: createActionCommand('delete', (actions, context) => actions.filesystem.delete(context)),
  paste: createActionCommand('paste', (actions, context) => actions.filesystem.paste(context)),
  duplicate: createActionCommand('duplicate', (actions, context) =>
    actions.filesystem.duplicate(context),
  ),
  restore: createActionCommand('restore', (actions, context) =>
    actions.filesystem.restore(context),
  ),
  permanentlyDelete: createActionCommand('permanentlyDelete', (actions, context) =>
    actions.filesystem.permanentlyDelete(context),
  ),
  emptyTrash: createActionCommand('emptyTrash', (actions, context) =>
    actions.filesystem.emptyTrash(context),
  ),
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
            operationItems: context.selectedItems ?? [],
          }),
      },
      {
        id: 'duplicate',
        commandId: 'duplicate',
        label: 'Duplicate',
        icon: Files,
        group: 'edit',
        priority: 88,
        applies: (context) =>
          p.hasSelection(context) &&
          p.allSelectedItemsNotTrashed(context) &&
          p.allSelectedItemsHaveFullAccess(context),
      },
    ],
  },
  {
    id: 'editor-danger',
    surfaces: ['sidebar', 'folder-view', 'topbar', 'trash-view'],
    getItems: () => [
      {
        id: 'delete',
        commandId: 'delete',
        label: 'Move to Trash',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context) =>
          p.canTrashSelectedItems(context) &&
          p.isSidebarItem(context) &&
          (p.inView('sidebar')(context) ||
            p.inView('folder-view')(context) ||
            p.inView('topbar')(context)),
      },
      {
        id: 'permanently-delete',
        commandId: 'permanentlyDelete',
        label: 'Delete Forever',
        icon: Trash2,
        group: 'danger',
        priority: 100,
        variant: 'danger',
        applies: (context) => p.canDeleteSelectedItemsForever(context) && p.isSidebarItem(context),
      },
      {
        id: 'empty-trash',
        commandId: 'emptyTrash',
        label: 'Empty Trash',
        icon: Trash2,
        group: 'danger',
        priority: 101,
        variant: 'danger',
        applies: (context) => p.isTrashView(context) && p.isDm(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
