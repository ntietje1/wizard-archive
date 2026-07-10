import { Share2, Sigma } from 'lucide-react'
import type { ContextMenuCommand, ContextMenuContributor } from '../../context-menu/types'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import { getNoteWorkspaceMenuContext } from './note-menu-context'
import { getBlockShareActionLabel } from '../sharing/block-share-targets'

interface BlockShareMenuService {
  canOpen: (context: WorkspaceMenuContext) => boolean
  canToggleAllPlayersPermission: () => boolean
  getBlockCount: (context: WorkspaceMenuContext) => number
  getAllPlayersPermissionLevel: () => 'hidden' | 'visible' | 'mixed'
  toggleAllPlayersPermission: () => void
}

export interface WorkspaceNoteContextMenuServices {
  blockShare: BlockShareMenuService
}

type WorkspaceContextMenuContributor = ContextMenuContributor<
  WorkspaceMenuContext,
  WorkspaceNoteContextMenuServices
>

function hasNoteBlockId(context: WorkspaceMenuContext): boolean {
  return getNoteWorkspaceMenuContext(context)?.noteBlockId !== undefined
}

function getContextMenuBlockShareActionLabel(
  context: WorkspaceMenuContext,
  services: WorkspaceNoteContextMenuServices,
) {
  const blockCount = services.blockShare.getBlockCount(context)
  const allPlayersPermissionLevel = services.blockShare.getAllPlayersPermissionLevel()
  return getBlockShareActionLabel(blockCount, allPlayersPermissionLevel)
}

export const noteContextMenuCommands = {
  editValueInline: {
    id: 'editValueInline',
    run: (context) => {
      const noteContext = getNoteWorkspaceMenuContext(context)
      if (!noteContext?.valueInlineId) return
      noteContext.openValueInline?.(noteContext.valueInlineId, noteContext.valueInlineInstanceId)
    },
  },
} satisfies Record<
  string,
  ContextMenuCommand<WorkspaceMenuContext, WorkspaceNoteContextMenuServices>
>

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
        applies: (context) => getNoteWorkspaceMenuContext(context)?.valueInlineEditable === true,
      },
    ],
  },
  {
    id: 'editor-note',
    surfaces: ['note-view'],
    getItems: () => [
      {
        id: 'share-blocks',
        label: getContextMenuBlockShareActionLabel,
        icon: Share2,
        group: 'share',
        priority: 1,
        applies: (context, services) =>
          hasNoteBlockId(context) && services.blockShare.canOpen(context),
        isEnabled: (_context, services) => services.blockShare.canToggleAllPlayersPermission(),
        onSelect: (_context, services) => services.blockShare.toggleAllPlayersPermission(),
        closeOnSelect: false,
      },
    ],
  },
] satisfies ReadonlyArray<WorkspaceContextMenuContributor>
