import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { File } from 'convex/files/types'

/**
 * Type guard to check if a sidebar item is a specific type.
 * Returns true if the item has the specified type, false otherwise.
 */
export function isSidebarItemType<T extends AnySidebarItem['type']>(
  item: AnySidebarItem | null | undefined,
  type: T,
): item is Extract<AnySidebarItem, { type: T }> {
  return (
    item !== null && item !== undefined && 'type' in item && item.type === type
  )
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
export function isFolder(
  item: AnySidebarItem | null | undefined,
): item is Folder {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.folders)
}

/**
 * Type guard to check if a sidebar item is a GameMap.
 */
export function isGameMap(
  item: AnySidebarItem | null | undefined,
): item is GameMap {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.gameMaps)
}

/**
 * Type guard to check if a sidebar item is a File.
 */
export function isFile(item: AnySidebarItem | null | undefined): item is File {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.files)
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
