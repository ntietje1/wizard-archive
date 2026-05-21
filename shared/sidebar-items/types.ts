export const SIDEBAR_ITEM_LOCATION = {
  sidebar: 'sidebar',
} as const

export type SidebarItemLocation = (typeof SIDEBAR_ITEM_LOCATION)[keyof typeof SIDEBAR_ITEM_LOCATION]

export const SIDEBAR_ITEM_STATUS = {
  active: 'active',
  trashed: 'trashed',
  undoHidden: 'undoHidden',
} as const

export type SidebarItemStatus = (typeof SIDEBAR_ITEM_STATUS)[keyof typeof SIDEBAR_ITEM_STATUS]

export const SIDEBAR_ITEM_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
  canvases: 'canvas',
} as const

export type SidebarItemType = (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export function isTrashedSidebarItem(item: { status: SidebarItemStatus }): boolean {
  return item.status === SIDEBAR_ITEM_STATUS.trashed
}
