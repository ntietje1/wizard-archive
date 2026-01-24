import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
} from '../gameMaps/types'
import type { Note, NoteFromDb, NoteWithContent } from '../notes/types'
import type { Folder, FolderFromDb, FolderWithContent } from '../folders/types'
import type { File, FileFromDb, FileWithContent } from '../files/types'

export type {
  SidebarItemType,
  SidebarItemOrRootType,
  SidebarItemShareStatus,
  SidebarItemId,
  SidebarItem,
  SidebarItemFromDb,
} from './baseTypes'

export type AnySidebarItemFromDb =
  | NoteFromDb
  | FolderFromDb
  | GameMapFromDb
  | FileFromDb

export type AnySidebarItem = Note | Folder | GameMap | File

export type AnySidebarItemWithContent =
  | NoteWithContent
  | GameMapWithContent
  | FolderWithContent
  | FileWithContent
