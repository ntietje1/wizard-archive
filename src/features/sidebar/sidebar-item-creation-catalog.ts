import { File, FilePlus, FolderPlus, Grid2x2Plus, MapPin } from 'lucide-react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { LucideIcon } from 'lucide-react'

type SidebarItemCreationKey = 'note' | 'folder' | 'map' | 'canvas' | 'file'
type SidebarItemCreationId = `create.${SidebarItemCreationKey}`

export type SidebarItemCreationType =
  | typeof SIDEBAR_ITEM_TYPES.notes
  | typeof SIDEBAR_ITEM_TYPES.folders
  | typeof SIDEBAR_ITEM_TYPES.gameMaps
  | typeof SIDEBAR_ITEM_TYPES.canvases
  | typeof SIDEBAR_ITEM_TYPES.files

export interface SidebarItemCreationCommand {
  id: SidebarItemCreationId
  key: SidebarItemCreationKey
  type: SidebarItemCreationType
  label: string
  dashboardDescription: string
  failureMessage: string
  icon: LucideIcon
  priority: number
}

export const SIDEBAR_ITEM_CREATION_COMMAND_BY_ID = {
  'create.note': {
    id: 'create.note',
    key: 'note',
    type: SIDEBAR_ITEM_TYPES.notes,
    label: 'Note',
    dashboardDescription: 'Write and organize your thoughts',
    failureMessage: 'Failed to create note',
    icon: FilePlus,
    priority: 10,
  },
  'create.folder': {
    id: 'create.folder',
    key: 'folder',
    type: SIDEBAR_ITEM_TYPES.folders,
    label: 'Folder',
    dashboardDescription: 'Group related items together',
    failureMessage: 'Failed to create folder',
    icon: FolderPlus,
    priority: 11,
  },
  'create.map': {
    id: 'create.map',
    key: 'map',
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    label: 'Map',
    dashboardDescription: 'Upload an image to pin items on',
    failureMessage: 'Failed to create map',
    icon: MapPin,
    priority: 12,
  },
  'create.canvas': {
    id: 'create.canvas',
    key: 'canvas',
    type: SIDEBAR_ITEM_TYPES.canvases,
    label: 'Canvas',
    dashboardDescription: 'Create a whiteboard to draw and organize nodes',
    failureMessage: 'Failed to create canvas',
    icon: Grid2x2Plus,
    priority: 13,
  },
  'create.file': {
    id: 'create.file',
    key: 'file',
    type: SIDEBAR_ITEM_TYPES.files,
    label: 'File',
    dashboardDescription: 'Upload a document, image, or media',
    failureMessage: 'Failed to create file',
    icon: File,
    priority: 14,
  },
} satisfies Record<SidebarItemCreationId, SidebarItemCreationCommand>

export const SIDEBAR_ITEM_CREATION_COMMANDS = [
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.note'],
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.folder'],
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.map'],
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.canvas'],
  SIDEBAR_ITEM_CREATION_COMMAND_BY_ID['create.file'],
] satisfies ReadonlyArray<SidebarItemCreationCommand>
