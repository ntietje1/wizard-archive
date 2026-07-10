import { creationContextMenuCommands, creationContextMenuContributors } from './creation-menu'
import type { WorkspaceCreationContextMenuServices } from './creation-menu'
import type { ContextMenuCommand } from '../../context-menu/types'
import { downloadContextMenuCommands, downloadContextMenuContributors } from './download-menu'
import type { WorkspaceDownloadContextMenuServices } from './download-menu'
import { filesystemContextMenuCommands, filesystemContextMenuContributors } from './filesystem-menu'
import type { WorkspaceFilesystemContextMenuServices } from './filesystem-menu'
import {
  workspaceItemEditContextMenuCommands,
  workspaceItemEditContextMenuContributors,
} from './item-edit-menu'
import type { WorkspaceItemEditContextMenuServices } from './item-edit-menu'
import { noteContextMenuCommands, noteContextMenuContributors } from '../../notes/context-menu/menu'
import type { WorkspaceNoteContextMenuServices } from '../../notes/context-menu/menu'
import {
  workspacePanelContextMenuCommands,
  workspacePanelContextMenuContributors,
} from './panel-menu'
import type { WorkspacePanelContextMenuServices } from './panel-menu'
import { sharingContextMenuCommands, sharingContextMenuContributors } from './sharing-menu'
import type { WorkspaceSharingContextMenuServices } from './sharing-menu'
import {
  sidebarItemContextMenuCommands,
  sidebarItemContextMenuContributors,
} from './sidebar-item-menu'
import type { WorkspaceSidebarItemContextMenuServices } from './sidebar-item-menu'
import type { WorkspaceMenuContext } from '../menu-context'
export type WorkspaceContextMenuServices = WorkspaceNoteContextMenuServices &
  WorkspaceSidebarItemContextMenuServices &
  WorkspaceCreationContextMenuServices &
  WorkspaceSharingContextMenuServices &
  WorkspaceDownloadContextMenuServices &
  WorkspaceFilesystemContextMenuServices &
  WorkspaceItemEditContextMenuServices &
  WorkspacePanelContextMenuServices

type WorkspaceContextMenuCommandRegistry = Readonly<
  Record<string, ContextMenuCommand<WorkspaceMenuContext, WorkspaceContextMenuServices, any>>
>

function mergeWorkspaceContextMenuCommandRegistries(
  ...registries: ReadonlyArray<WorkspaceContextMenuCommandRegistry>
): WorkspaceContextMenuCommandRegistry {
  const commands: Record<
    string,
    ContextMenuCommand<WorkspaceMenuContext, WorkspaceContextMenuServices, any>
  > = {}

  for (const registry of registries) {
    for (const [id, command] of Object.entries(registry)) {
      if (Object.hasOwn(commands, id)) {
        throw new Error(`Duplicate workspace context menu command id: ${id}`)
      }
      commands[id] = command
    }
  }

  return commands
}

export const workspaceContextMenuCommands = mergeWorkspaceContextMenuCommandRegistries(
  noteContextMenuCommands,
  sidebarItemContextMenuCommands,
  creationContextMenuCommands,
  sharingContextMenuCommands,
  downloadContextMenuCommands,
  filesystemContextMenuCommands,
  workspaceItemEditContextMenuCommands,
  workspacePanelContextMenuCommands,
)

export const workspaceContextMenuContributors = [
  ...noteContextMenuContributors,
  ...sidebarItemContextMenuContributors,
  ...creationContextMenuContributors,
  ...sharingContextMenuContributors,
  ...downloadContextMenuContributors,
  ...filesystemContextMenuContributors,
  ...workspaceItemEditContextMenuContributors,
  ...workspacePanelContextMenuContributors,
]
