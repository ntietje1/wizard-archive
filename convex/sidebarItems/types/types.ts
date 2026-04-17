import type { GameMap, GameMapFromDb, GameMapWithContent } from '../../gameMaps/types'
import type { Note, NoteFromDb, NoteWithContent } from '../../notes/types'
import type { Folder, FolderFromDb, FolderWithContent } from '../../folders/types'
import type { FileFromDb, FileWithContent, SidebarFile } from '../../files/types'
import type { Canvas, CanvasFromDb, CanvasWithContent } from '../../canvases/types'
import type { SIDEBAR_ITEM_TYPES, SidebarItemRow, SidebarItemType } from './baseTypes'

export type SidebarItemTypeKey = keyof typeof SIDEBAR_ITEM_TYPES

type CompleteSidebarItemTypeMap<T extends Record<SidebarItemTypeKey, unknown>> = T

export type RowByType = CompleteSidebarItemTypeMap<{
  notes: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.notes>
  folders: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.folders>
  gameMaps: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.gameMaps>
  files: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.files>
  canvases: SidebarItemRow<typeof SIDEBAR_ITEM_TYPES.canvases>
}>

export type FromDbByType = CompleteSidebarItemTypeMap<{
  notes: NoteFromDb
  folders: FolderFromDb
  gameMaps: GameMapFromDb
  files: FileFromDb
  canvases: CanvasFromDb
}>

export type EnhancedByType = CompleteSidebarItemTypeMap<{
  notes: Note
  folders: Folder
  gameMaps: GameMap
  files: SidebarFile
  canvases: Canvas
}>

export type WithContentByType = CompleteSidebarItemTypeMap<{
  notes: NoteWithContent
  folders: FolderWithContent
  gameMaps: GameMapWithContent
  files: FileWithContent
  canvases: CanvasWithContent
}>

export type AnySidebarItemRow = RowByType[SidebarItemTypeKey]

export type AnySidebarItemFromDb = FromDbByType[SidebarItemTypeKey]

export type AnySidebarItem = EnhancedByType[SidebarItemTypeKey]

export type AnySidebarItemWithContent = WithContentByType[SidebarItemTypeKey]

export type WithContentBySidebarItemType<T extends SidebarItemType> = Extract<
  AnySidebarItemWithContent,
  { type: T }
>

export type EnhancedSidebarItem<T extends AnySidebarItemFromDb> = Extract<
  EnhancedByType[SidebarItemTypeKey],
  { type: T['type'] }
>

export type WithContentSidebarItem<T extends AnySidebarItem> = Extract<
  WithContentByType[SidebarItemTypeKey],
  { type: T['type'] }
>
