import { RESOURCE_TYPES } from '../../items-persistence-contract'
import type { AnyItem, FolderItem, ItemByResourceKind } from '../../items'
import type { FileItem } from '../../../files/item-contract'
import type { MapItem } from '../../../game-maps/item-contract'
import type { NoteItem } from '../../../notes/item-contract'

function isSidebarItemType<T extends AnyItem['type']>(
  item: AnyItem | null | undefined,
  type: T,
): item is ItemByResourceKind<T> {
  return item !== null && item !== undefined && item.type === type
}

export function isNoteItem(item: AnyItem | null | undefined): item is NoteItem {
  return isSidebarItemType(item, RESOURCE_TYPES.notes)
}

export function isFolderItem(item: AnyItem | null | undefined): item is FolderItem {
  return isSidebarItemType(item, RESOURCE_TYPES.folders)
}

export function isMapItem(item: AnyItem | null | undefined): item is MapItem {
  return isSidebarItemType(item, RESOURCE_TYPES.gameMaps)
}

export function isFileItem(item: AnyItem | null | undefined): item is FileItem {
  return isSidebarItemType(item, RESOURCE_TYPES.files)
}
