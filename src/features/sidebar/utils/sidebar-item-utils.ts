import { getDefaultSidebarItemIconName } from 'convex/sidebarItems/icon'
import type { SidebarItemIconName } from 'convex/sidebarItems/icon'
import { DEFAULT_SIDEBAR_ITEM_COLOR } from 'convex/sidebarItems/color'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/slug'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { Canvas } from 'convex/canvases/types'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { assertNever } from '~/shared/utils/utils'

export const DEFAULT_ITEM_COLOR = DEFAULT_SIDEBAR_ITEM_COLOR

export const getSlug = (search: EditorSearch): SidebarItemSlug | null => {
  return search.item ?? null
}

/**
 * Type guard to check if a sidebar item is a specific type.
 * Returns true if the item has the specified type, false otherwise.
 */
export function isSidebarItemType<T extends AnySidebarItem['type']>(
  item: AnySidebarItem | null | undefined,
  type: T,
): item is Extract<AnySidebarItem, { type: T }> {
  return item !== null && item !== undefined && 'type' in item && item.type === type
}

/**
 * Type guard to check if a sidebar item is a Note.
 */
export function isNote(item: AnySidebarItem | null | undefined): item is Note {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.notes)
}

/**
 * Type guard to check if a sidebar item is a Folder.
 */
export function isFolder(item: AnySidebarItem | null | undefined): item is Folder {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.folders)
}

/**
 * Type guard to check if a sidebar item is a GameMap.
 */
export function isGameMap(item: AnySidebarItem | null | undefined): item is GameMap {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.gameMaps)
}

/**
/**
 * Type guard to check if a sidebar item is a SidebarFile.
 */
export function isFile(item: AnySidebarItem | null | undefined): item is SidebarFile {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.files)
}

/**
 * Type guard to check if a sidebar item is a Canvas.
 */
export function isCanvas(item: AnySidebarItem | null | undefined): item is Canvas {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.canvases)
}

/**
 * Safely extracts a typed sidebar item from a union type.
 * Returns the item if it matches the specified type, undefined otherwise.
 */
export function getSidebarItemAs<T extends AnySidebarItem['type']>(
  item: AnySidebarItem | null | undefined,
  type: T,
): Extract<AnySidebarItem, { type: T }> | undefined {
  return isSidebarItemType(item, type) ? item : undefined
}

export function getItemTypeLabel(type: SidebarItemType): string {
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    case SIDEBAR_ITEM_TYPES.canvases:
      return 'Canvas'
    default:
      return assertNever(type)
  }
}

export function buildBreadcrumbs(
  item: AnySidebarItem,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): string {
  const path: Array<string> = []
  let currentId = item.parentId

  while (currentId && itemsMap.has(currentId)) {
    const parent = itemsMap.get(currentId)!
    path.unshift(parent.name)
    currentId = parent.parentId
  }
  if (path.length > 0) {
    return path.join('/') + '/'
  }
  return ''
}

export function getTypeName(type: SidebarItemType): string {
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'Note'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'Map'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    case SIDEBAR_ITEM_TYPES.canvases:
      return 'Canvas'
    default:
      return assertNever(type)
  }
}

export function getDefaultIconName(type: SidebarItemType): SidebarItemIconName {
  return getDefaultSidebarItemIconName(type)
}
