import { File, FilePlus, FolderPlus, Grid2x2Plus, MapPin } from 'lucide-react'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { ResourceKind } from '../workspace/resource-contract'
import type { LucideIcon } from 'lucide-react'

export interface CreateItemOption {
  key: string
  type: ResourceKind
  label: string
  defaultName: string
  dashboardDescription: string
  icon: LucideIcon
}

export const CREATE_NOTE_OPTION = {
  key: 'note',
  type: RESOURCE_TYPES.notes,
  label: 'Note',
  defaultName: 'Untitled Note',
  dashboardDescription: 'Write and organize your thoughts',
  icon: FilePlus,
} as const satisfies CreateItemOption

export const CREATE_ITEM_OPTIONS = [
  CREATE_NOTE_OPTION,
  {
    key: 'folder',
    type: RESOURCE_TYPES.folders,
    label: 'Folder',
    defaultName: 'Untitled Folder',
    dashboardDescription: 'Group related items together',
    icon: FolderPlus,
  },
  {
    key: 'map',
    type: RESOURCE_TYPES.canvases,
    label: 'Map',
    defaultName: 'Untitled Map',
    dashboardDescription: 'Create a canvas for maps, pins, and references',
    icon: MapPin,
  },
  {
    key: 'canvas',
    type: RESOURCE_TYPES.canvases,
    label: 'Canvas',
    defaultName: 'Untitled Canvas',
    dashboardDescription: 'Create a whiteboard to draw and organize nodes',
    icon: Grid2x2Plus,
  },
  {
    key: 'file',
    type: RESOURCE_TYPES.files,
    label: 'File',
    defaultName: 'Untitled File',
    dashboardDescription: 'Upload a document, image, or media',
    icon: File,
  },
] as const satisfies ReadonlyArray<CreateItemOption>
