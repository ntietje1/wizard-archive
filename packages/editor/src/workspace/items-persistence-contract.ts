export const RESOURCE_LOCATION = {
  sidebar: 'sidebar',
} as const

export const RESOURCE_STATUS = {
  active: 'active',
  trashed: 'trashed',
  undoHidden: 'undoHidden',
} as const

export const RESOURCE_STATUS_VALUES = [
  RESOURCE_STATUS.active,
  RESOURCE_STATUS.trashed,
  RESOURCE_STATUS.undoHidden,
] as const

export const TRASH_RETENTION_DAYS = 30

export const RESOURCE_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
  canvases: 'canvas',
} as const

export const RESOURCE_TYPE_VALUES = [
  RESOURCE_TYPES.notes,
  RESOURCE_TYPES.folders,
  RESOURCE_TYPES.gameMaps,
  RESOURCE_TYPES.files,
  RESOURCE_TYPES.canvases,
] as const

export const RESOURCE_ICON_NAMES = [
  'Apple',
  'Axe',
  'Beef',
  'Bird',
  'BowArrow',
  'Box',
  'Calendar',
  'Cat',
  'Cherry',
  'Dog',
  'File',
  'FileText',
  'Flame',
  'Folder',
  'Gem',
  'Grid2x2Plus',
  'Heart',
  'Locate',
  'MapPin',
  'MessageCircleWarning',
  'Moon',
  'Mountain',
  'Music',
  'Notebook',
  'Share2',
  'Shield',
  'Sparkles',
  'Squirrel',
  'Star',
  'Sun',
  'Sword',
  'User',
] as const

export const SORT_ORDERS = {
  Alphabetical: 'Alphabetical',
  DateCreated: 'DateCreated',
  DateModified: 'DateModified',
} as const

export const SORT_ORDER_VALUES = [
  SORT_ORDERS.Alphabetical,
  SORT_ORDERS.DateCreated,
  SORT_ORDERS.DateModified,
] as const

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS]

export const SORT_DIRECTIONS = {
  Ascending: 'Ascending',
  Descending: 'Descending',
} as const

export const SORT_DIRECTION_VALUES = [
  SORT_DIRECTIONS.Ascending,
  SORT_DIRECTIONS.Descending,
] as const

export type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS]

export type SortOptions = {
  order: SortOrder
  direction: SortDirection
}

export const DEFAULT_SORT_OPTIONS: SortOptions = {
  order: SORT_ORDERS.DateCreated,
  direction: SORT_DIRECTIONS.Descending,
}
