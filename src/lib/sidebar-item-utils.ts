import {
  SIDEBAR_ITEM_TYPES,
  type AnySidebarItem,
} from 'convex/sidebarItems/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { Tag, TagCategory } from 'convex/tags/types'
import type { GameMap } from 'convex/gameMaps/types'

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
 * Type guard to check if a sidebar item is a TagCategory.
 */
export function isTagCategory(
  item: AnySidebarItem | null | undefined,
): item is TagCategory {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.tagCategories)
}

/**
 * Type guard to check if a sidebar item is a Tag.
 */
export function isTag(item: AnySidebarItem | null | undefined): item is Tag {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.tags)
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
 * Type guard to check if a sidebar item is a Category.
 */
export function isCategory(
  item: AnySidebarItem | null | undefined,
): item is TagCategory {
  return isSidebarItemType(item, SIDEBAR_ITEM_TYPES.tagCategories)
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
