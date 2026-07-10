export const WORKSPACE_MODE = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
} as const

export type WorkspaceMode = (typeof WORKSPACE_MODE)[keyof typeof WORKSPACE_MODE]
