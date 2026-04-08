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
import type {
  Canvas,
  CanvasFromDb,
  CanvasWithContent,
} from '../../canvases/types'

export type AnySidebarItemFromDb =
  | NoteFromDb
  | FolderFromDb
  | GameMapFromDb
  | FileFromDb
  | CanvasFromDb

export type AnySidebarItem = Note | Folder | GameMap | SidebarFile | Canvas

export type AnySidebarItemWithContent =
  | NoteWithContent
  | GameMapWithContent
  | FolderWithContent
  | FileWithContent
  | CanvasWithContent

export type EnhancedSidebarItem<T extends AnySidebarItemFromDb> =
  T extends NoteFromDb
    ? Note
    : T extends FolderFromDb
      ? Folder
      : T extends GameMapFromDb
        ? GameMap
        : T extends FileFromDb
          ? SidebarFile
          : T extends CanvasFromDb
            ? Canvas
            : never
