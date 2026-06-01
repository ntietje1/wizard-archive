export const SORT_ORDERS = {
  Alphabetical: 'Alphabetical',
  DateCreated: 'DateCreated',
  DateModified: 'DateModified',
} as const

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS]

export const SORT_DIRECTIONS = {
  Ascending: 'Ascending',
  Descending: 'Descending',
} as const

export type SortDirection = (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS]

export type SortOptions = {
  order: SortOrder
  direction: SortDirection
}

type EditorSortFields = {
  sortOrder: SortOrder
  sortDirection: SortDirection
}

export const EDITOR_MODE = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
} as const

export type EditorMode = (typeof EDITOR_MODE)[keyof typeof EDITOR_MODE]

export type Editor = EditorSortFields & {
  editorMode: EditorMode
}
