import {
  type AnySidebarItem,
  SIDEBAR_ITEM_TYPES,
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import { NoteButton } from '../sidebar-note/note-button'
import { FolderWithChildren } from '../sidebar-folder/folder-with-children'
import { MapButton } from '../sidebar-map/map-button'
import type { ComponentType } from 'react'
import type { Id } from 'convex/_generated/dataModel'

interface SidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Id<'folders'>[]
}

// Component registry for sidebar items
const SIDEBAR_ITEM_COMPONENT_REGISTRY: Record<
  SidebarItemType,
  ComponentType<any>
> = {
  [SIDEBAR_ITEM_TYPES.folders]: FolderWithChildren,
  [SIDEBAR_ITEM_TYPES.notes]: NoteButton,
  [SIDEBAR_ITEM_TYPES.gameMaps]: MapButton,
}

export const SidebarItem = ({ item, ancestorIds = [] }: SidebarItemProps) => {
  const Component = SIDEBAR_ITEM_COMPONENT_REGISTRY[item.type]

  if (!Component) {
    throw new Error(`Invalid item type: ${item.type}`)
  }

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    return <Component folder={item} ancestorIds={ancestorIds} />
  }

  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    return <Component note={item} ancestorIds={ancestorIds} />
  }

  if (item.type === SIDEBAR_ITEM_TYPES.gameMaps) {
    return <Component map={item} ancestorIds={ancestorIds} />
  }

  throw new Error('Invalid item type or missing required properties')
}
