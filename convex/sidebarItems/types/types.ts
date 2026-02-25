import type {
  GameMap,
  GameMapFromDb,
  GameMapWithContent,
} from '../../gameMaps/types'
import type { Note, NoteFromDb, NoteWithContent } from '../../notes/types'
import type {
  Folder,
  FolderFromDb,
  FolderWithContent,
} from '../../folders/types'
import type {
  FileFromDb,
  FileWithContent,
  SidebarFile,
} from '../../files/types'

export type AnySidebarItemFromDb =
  | NoteFromDb
  | FolderFromDb
  | GameMapFromDb
  | FileFromDb

export type AnySidebarItem = Note | Folder | GameMap | SidebarFile

export type AnySidebarItemWithContent =
  | NoteWithContent
  | GameMapWithContent
  | FolderWithContent
  | FileWithContent

export type EnhancedSidebarItem<T extends AnySidebarItemFromDb> =
  T extends NoteFromDb
    ? Note
    : T extends FolderFromDb
      ? Folder
      : T extends GameMapFromDb
        ? GameMap
        : T extends FileFromDb
          ? SidebarFile
          : never
