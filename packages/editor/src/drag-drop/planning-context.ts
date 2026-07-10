export interface DropPlanningContext {
  canCreateRootItems: boolean
  canManageFolders: boolean
  workspaceId: string | null
  workspaceName: string | null
}

export type SurfaceDropPlanningContext = Pick<DropPlanningContext, 'workspaceId'>
