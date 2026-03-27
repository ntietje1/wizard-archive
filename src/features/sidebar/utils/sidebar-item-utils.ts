import {
  DEFAULT_ITEM_COLOR,
  SIDEBAR_ITEM_TYPES,
} from 'convex/sidebarItems/types/baseTypes'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Note } from 'convex/notes/types'
import type { Folder } from 'convex/folders/types'
import type { GameMap } from 'convex/gameMaps/types'
import type { SidebarFile } from 'convex/files/types'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { assertNever } from '~/shared/utils/utils'

export const getSlug = (search: EditorSearch): string | null => {
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
/**
 * Type guard to check if a sidebar item is a SidebarFile.
 */
export function isFile(
  item: AnySidebarItem | null | undefined,
): item is SidebarFile {
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
      return assertNever(type)
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

export function buildBreadcrumbs(
  item: AnySidebarItem,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
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
    default:
      return assertNever(type)
  }
}

export function getDefaultIconName(type: SidebarItemType): string {
  switch (type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return 'FileText'
    case SIDEBAR_ITEM_TYPES.folders:
      return 'Folder'
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return 'MapPin'
    case SIDEBAR_ITEM_TYPES.files:
      return 'File'
    default:
      return assertNever(type)
  }
}
