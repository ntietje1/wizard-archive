import { ClipboardCopy, ClipboardPaste, Scissors, Share2, Sigma } from 'lucide-react'
import { toast } from 'sonner'
import * as p from '../predicates'
import type {
  ContextMenuCommand,
  ContextMenuContributor,
  EditorContextMenuServices,
  EditorMenuContext,
} from '../types'

type EditorContextMenuContributor = ContextMenuContributor<
  EditorMenuContext,
  EditorContextMenuServices
>

function getBlockShareTargetLabel(blockCount: number) {
  return blockCount === 1 ? 'Block' : `${blockCount} Blocks`
}

function getBlockShareActionLabel(context: EditorMenuContext, services: EditorContextMenuServices) {
  const blockCount = services.blockShare.getBlockCount(context)
  const targetLabel = getBlockShareTargetLabel(blockCount)
  const allPlayersPermissionLevel = services.blockShare.getAllPlayersPermissionLevel(context)
  return allPlayersPermissionLevel === 'visible' ? `Unshare ${targetLabel}` : `Share ${targetLabel}`
}

export const noteContextMenuCommands = {
  showComingSoon: {
    id: 'showComingSoon',
    run: () => {
      toast.info('Coming soon')
    },
  },
  editValueInline: {
    id: 'editValueInline',
    run: (context) => {
      if (!context.valueInlineId) return
      context.openValueInline?.(context.valueInlineId, context.valueInlineInstanceId)
    },
  },
} satisfies Record<string, ContextMenuCommand<EditorMenuContext, EditorContextMenuServices>>

export const noteContextMenuContributors = [
  {
    id: 'editor-value-inline',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'edit-value-inline',
        commandId: 'editValueInline',
        label: 'Edit Value',
        icon: Sigma,
        group: 'primary',
        priority: 0,
        applies: (context) => p.hasEditableValueInlineId(context),
      },
    ],
  },
  {
    id: 'editor-note',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'share-blocks',
        label: getBlockShareActionLabel,
        icon: Share2,
        group: 'share',
        priority: 1,
        applies: (context, services) =>
          p.isDm(context) && p.hasBlockNoteId(context) && services.blockShare.canOpen(context),
        isEnabled: (context, services) =>
          services.blockShare.canToggleAllPlayersPermission(context),
        onSelect: (context, services) => services.blockShare.toggleAllPlayersPermission(context),
        closeOnSelect: false,
      },
    ],
  },
  {
    id: 'editor-note-clipboard',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'editor-paste',
        commandId: 'showComingSoon',
        label: 'Paste',
        icon: ClipboardPaste,
        shortcut: 'Ctrl+V',
        group: 'edit',
        priority: 84,
        applies: (context) => p.isEditorTextContext(context),
      },
      {
        id: 'editor-cut',
        commandId: 'showComingSoon',
        label: 'Cut',
        icon: Scissors,
        shortcut: 'Ctrl+X',
        group: 'edit',
        priority: 85,
        applies: (context) => p.hasEditorTextSelection(context),
      },
      {
        id: 'editor-copy',
        commandId: 'showComingSoon',
        label: 'Copy',
        icon: ClipboardCopy,
        shortcut: 'Ctrl+C',
        group: 'edit',
        priority: 86,
        applies: (context) => p.hasEditorTextSelection(context),
      },
    ],
  },
] satisfies ReadonlyArray<EditorContextMenuContributor>
