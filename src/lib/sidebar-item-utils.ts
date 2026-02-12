import {
  DEFAULT_ITEM_COLOR,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/baseTypes'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { File } from 'convex/files/types'
import type { EditorSearch } from '~/components/notes-page/validate-search'

/** True when the item is a client-side optimistic placeholder not yet persisted to the server. */
export function isOptimistic(item: AnySidebarItem | null | undefined): boolean {
  return !!item?._optimistic
}

// Determine type and slug from search params
export const getTypeAndSlug = (
  search: EditorSearch,
): { type: SidebarItemType; slug: string } | null => {
  if (search.note) {
    return { type: SIDEBAR_ITEM_TYPES.notes, slug: search.note }
  }
  if (search.map) {
    return { type: SIDEBAR_ITEM_TYPES.gameMaps, slug: search.map }
  }
  if (search.folder) {
    return { type: SIDEBAR_ITEM_TYPES.folders, slug: search.folder }
  }
  if (search.file) {
    return { type: SIDEBAR_ITEM_TYPES.files, slug: search.file }
  }
  return null
}

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
    default:
      return 'Item'
  }
}

export function isValidHexColor(color: string | undefined | null): boolean {
  if (!color) return false
  // Check if it's a valid hex color (#RRGGBB or #RRGGBBAA)
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(color)
}

export const validateHexColorOrDefault = (
  colorValue: string | undefined | null,
  defaultColor: string = DEFAULT_ITEM_COLOR,
): string => {
  if (!colorValue) return defaultColor

  const isValidHex = isValidHexColor(colorValue)

  return isValidHex ? colorValue : defaultColor
}

/**
 * Build breadcrumb path from parentId chain
 * Traverses up the parent hierarchy to create a path like "Folder / Subfolder"
 */
export function buildBreadcrumbs(
  item: AnySidebarItem,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): string {
  const path: Array<string> = []
  let currentId = item.parentId

  while (currentId && itemsMap.has(currentId)) {
    const parent = itemsMap.get(currentId)!
    path.unshift(parent.name || defaultItemName(parent))
    currentId = parent.parentId
  }
  if (path.length > 0) {
    return path.join('/') + '/'
  }
  return ''
}
