export const RIGHT_SIDEBAR_CONTENT = {
  history: 'history',
  backlinks: 'backlinks',
  outgoing: 'outgoing',
  outline: 'outline',
} as const

export type RightSidebarContentId =
  (typeof RIGHT_SIDEBAR_CONTENT)[keyof typeof RIGHT_SIDEBAR_CONTENT]
