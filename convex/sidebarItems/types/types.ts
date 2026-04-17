import type { GameMap, GameMapFromDb, GameMapWithContent } from '../../gameMaps/types'
import type { Note, NoteFromDb, NoteWithContent } from '../../notes/types'
import type { Folder, FolderFromDb, FolderWithContent } from '../../folders/types'
import type { FileFromDb, FileWithContent, SidebarFile } from '../../files/types'
import type { Canvas, CanvasFromDb, CanvasWithContent } from '../../canvases/types'
import type { SIDEBAR_ITEM_TYPES, SidebarItemType } from './baseTypes'

export type SidebarItemTypeKey = keyof typeof SIDEBAR_ITEM_TYPES

export type FromDbByType = {
  notes: NoteFromDb
  folders: FolderFromDb
  gameMaps: GameMapFromDb
  files: FileFromDb
  canvases: CanvasFromDb
}

export type EnhancedByType = {
  notes: Note
  folders: Folder
  gameMaps: GameMap
  files: SidebarFile
  canvases: Canvas
}

export type WithContentByType = {
  notes: NoteWithContent
  folders: FolderWithContent
  gameMaps: GameMapWithContent
  files: FileWithContent
  canvases: CanvasWithContent
}

export type AnySidebarItemFromDb = FromDbByType[SidebarItemTypeKey]

export type AnySidebarItem = EnhancedByType[SidebarItemTypeKey]

export type AnySidebarItemWithContent = WithContentByType[SidebarItemTypeKey]

export type WithContentBySidebarItemType<T extends SidebarItemType> = Extract<
  AnySidebarItemWithContent,
  { type: T }
>

export type EnhancedSidebarItem<T extends AnySidebarItemFromDb> = T extends NoteFromDb
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

export type WithContentSidebarItem<T extends AnySidebarItem> = T extends Note
  ? NoteWithContent
  : T extends Folder
    ? FolderWithContent
    : T extends GameMap
      ? GameMapWithContent
      : T extends SidebarFile
        ? FileWithContent
        : T extends Canvas
          ? CanvasWithContent
          : never
