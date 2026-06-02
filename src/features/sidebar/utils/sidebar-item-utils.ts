import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { SidebarItemType } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'shared/sidebar-items/slug'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Note } from 'shared/notes/types'
import type { Folder } from 'shared/folders/types'
import type { GameMap } from 'shared/game-maps/types'
import type { SidebarFile } from 'shared/files/types'
import type { EditorSearch } from '~/features/sidebar/utils/validate-search'
import { assertNever } from '~/shared/utils/utils'

export const getSlug = (search: EditorSearch): SidebarItemSlug | null => {
  return search.item ?? null
}

/**
 * Type guard to check if a sidebar item is a specific type.
 * Returns true if the item has the specified type, false otherwise.
 */
function isSidebarItemType<T extends AnySidebarItem['type']>(
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
  const visitedIds = new Set<Id<'sidebarItems'>>([item._id])
  let currentId = item.parentId

  while (currentId && itemsMap.has(currentId)) {
    if (visitedIds.has(currentId)) break
    visitedIds.add(currentId)
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
