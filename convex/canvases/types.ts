import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'

export type CanvasFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.canvases>

export type Canvas = SidebarItem<typeof SIDEBAR_ITEM_TYPES.canvases>

export type CanvasWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.canvases
>

export const CANVAS_SNAPSHOT_TYPE = 'yjs_state' as const

export const CANVAS_HISTORY_ACTION = {} as const

export type CanvasHistoryMetadataMap = Record<string, never>
