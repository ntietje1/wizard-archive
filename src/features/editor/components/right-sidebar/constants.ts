export const RIGHT_SIDEBAR_CONTENT = {
  history: 'history',
  backlinks: 'backlinks',
  outgoing: 'outgoing',
  outline: 'outline',
} as const

export type RightSidebarContentId =
  (typeof RIGHT_SIDEBAR_CONTENT)[keyof typeof RIGHT_SIDEBAR_CONTENT]

export const RIGHT_SIDEBAR_PANEL_ID = 'editor-right-sidebar'
export const RIGHT_SIDEBAR_DEFAULTS = { size: 300, visible: false } as const
