import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { WORKSPACE_MODE } from '../../../../../shared/workspace/workspace-mode'
import type { WorkspaceMode } from '../../../../../shared/workspace/workspace-mode'
import { isTrashedSidebarItem } from '../../workspace/items/status'
import type { AnyItem } from '../../workspace/items'
import { actorCanMutateResource } from './permission-resolution'
import type { EditorWorkspaceActor, ResourcePermissionContext } from './permission-resolution'

export function resolveResourceWorkspaceModePolicy({
  actor,
  currentItem,
  getItemById,
  rawWorkspaceMode,
}: {
  actor: EditorWorkspaceActor | null
  currentItem: AnyItem | null
  getItemById: ResourcePermissionContext['getItemById']
  rawWorkspaceMode: WorkspaceMode
}): { canEdit: boolean; workspaceMode: WorkspaceMode } {
  const canEdit =
    !!currentItem &&
    !isTrashedSidebarItem(currentItem) &&
    actorCanMutateResource(currentItem, PERMISSION_LEVEL.EDIT, { actor, getItemById })

  return {
    canEdit,
    workspaceMode: canEdit ? rawWorkspaceMode : WORKSPACE_MODE.VIEWER,
  }
}
