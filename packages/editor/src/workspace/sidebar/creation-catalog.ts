import { File, FilePlus, FolderPlus, Grid2x2Plus, MapPin } from 'lucide-react'
import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { ResourceKind } from '../resource-contract'
import type { LucideIcon } from 'lucide-react'

type SidebarItemCreationKey = 'note' | 'folder' | 'map' | 'canvas' | 'file'
type SidebarItemCreationId = `create.${SidebarItemCreationKey}`

type SidebarItemCreationCommandDefinition = {
  type: ResourceKind
  label: string
  defaultName: string
  dashboardDescription: string
  failureMessage: string
  icon: LucideIcon
}

export interface SidebarItemCreationCommand extends SidebarItemCreationCommandDefinition {
  id: SidebarItemCreationId
  key: SidebarItemCreationKey
}

const SIDEBAR_ITEM_CREATION_ENTRIES = [
  {
    key: 'note',
    type: RESOURCE_TYPES.notes,
    label: 'Note',
    defaultName: 'Untitled Note',
    dashboardDescription: 'Write and organize your thoughts',
    failureMessage: 'Failed to create note',
    icon: FilePlus,
  },
  {
    key: 'folder',
    type: RESOURCE_TYPES.folders,
    label: 'Folder',
    defaultName: 'Untitled Folder',
    dashboardDescription: 'Group related items together',
    failureMessage: 'Failed to create folder',
    icon: FolderPlus,
  },
  {
    key: 'map',
    type: RESOURCE_TYPES.gameMaps,
    label: 'Map',
    defaultName: 'Untitled Map',
    dashboardDescription: 'Create a canvas for maps, pins, and references',
    failureMessage: 'Failed to create map',
    icon: MapPin,
  },
  {
    key: 'canvas',
    type: RESOURCE_TYPES.canvases,
    label: 'Canvas',
    defaultName: 'Untitled Canvas',
    dashboardDescription: 'Create a whiteboard to draw and organize nodes',
    failureMessage: 'Failed to create canvas',
    icon: Grid2x2Plus,
  },
  {
    key: 'file',
    type: RESOURCE_TYPES.files,
    label: 'File',
    defaultName: 'Untitled File',
    dashboardDescription: 'Upload a document, image, or media',
    failureMessage: 'Failed to create file',
    icon: File,
  },
] satisfies ReadonlyArray<SidebarItemCreationCommandDefinition & { key: SidebarItemCreationKey }>

function createSidebarItemCreationCommand(
  entry: SidebarItemCreationCommandDefinition & { key: SidebarItemCreationKey },
): SidebarItemCreationCommand {
  return {
    id: `create.${entry.key}` as SidebarItemCreationId,
    ...entry,
  }
}

const SIDEBAR_ITEM_CREATION_COMMANDS_INTERNAL = SIDEBAR_ITEM_CREATION_ENTRIES.map(
  createSidebarItemCreationCommand,
)

export const SIDEBAR_ITEM_CREATION_COMMAND_BY_ID: Readonly<
  Record<string, SidebarItemCreationCommand>
> = Object.fromEntries(
  SIDEBAR_ITEM_CREATION_COMMANDS_INTERNAL.map((command) => [command.id, command]),
)

export const SIDEBAR_ITEM_CREATION_COMMANDS: ReadonlyArray<SidebarItemCreationCommand> =
  SIDEBAR_ITEM_CREATION_COMMANDS_INTERNAL
