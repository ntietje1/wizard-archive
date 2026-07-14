import type { ResourceId } from '../resources/domain-id'
import { WORKSPACE_MODE } from '../../../../shared/workspace/workspace-mode'
import type { WorkspaceMode } from '../../../../shared/workspace/workspace-mode'
import { createWorkspaceResourceReadModel } from '../workspace/items'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import type { FileSystemPermissions } from './permissions'
import {
  actorCanMutateResource,
  actorHasResourcePermission,
  getMemberResourcePermissionLevel,
} from './domain/permission-resolution'
import type {
  EditorWorkspaceActor,
  ResourcePermissionContext,
} from './domain/permission-resolution'
import { filterVisibleResourcesForActor } from './domain/visibility-filter'
import { resolveResourceWorkspaceModePolicy } from './domain/workspace-mode-policy'

type ActorFileSystemPermissionsInput = {
  actor: EditorWorkspaceActor | null
  canEdit: boolean
  canCreateItems: boolean
  canEmptyTrash: boolean
  canManageFolders: boolean
  getItemById: (itemId: ResourceId) => AnyItem | null | undefined
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  workspaceMode: WorkspaceMode
}

type FileSystemItemsReadState = {
  data: Array<AnyItem>
  readModel: WorkspaceResourceReadModel<AnyItem>
  status: 'pending' | 'error' | 'success'
  error: Error | null
  refresh: () => Promise<unknown>
}

export function filterFileSystemItemsForActor(
  activeItems: FileSystemItemsReadState,
  actor: EditorWorkspaceActor | null,
): FileSystemItemsReadState {
  if (actor?.kind === 'owner') return activeItems

  const filteredData = filterVisibleResourcesForActor({
    actor,
    getItemById: activeItems.readModel.getItem,
    resources: activeItems.data,
  })

  return {
    data: filteredData,
    status: activeItems.status,
    error: activeItems.error,
    refresh: activeItems.refresh,
    readModel: createWorkspaceResourceReadModel(filteredData),
  }
}

export function resolveWorkspaceModeForItem({
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
  return resolveResourceWorkspaceModePolicy({
    actor,
    currentItem,
    getItemById,
    rawWorkspaceMode,
  })
}

export function createActorFileSystemPermissions({
  actor,
  canEdit,
  canCreateItems,
  canEmptyTrash,
  canManageFolders,
  getItemById,
  setWorkspaceMode,
  workspaceMode,
}: ActorFileSystemPermissionsInput): FileSystemPermissions {
  const permissionContext = { actor, getItemById }
  const canMutateThroughActor = actor?.kind !== 'owner_view_as'

  return {
    workspaceMode: canEdit && canMutateThroughActor ? workspaceMode : WORKSPACE_MODE.VIEWER,
    setWorkspaceMode: (mode) => {
      if (canEdit && canMutateThroughActor) setWorkspaceMode(mode)
    },
    canEdit: canEdit && canMutateThroughActor,
    canCreateItems: canMutateThroughActor && canCreateItems,
    canEmptyTrash: canMutateThroughActor && canEmptyTrash,
    canManageFolders: canMutateThroughActor && canManageFolders,
    canAccessItem: (item, requiredLevel) =>
      actorHasResourcePermission(item, requiredLevel, permissionContext),
    canMutateItem: (item, requiredLevel) =>
      canEdit &&
      canMutateThroughActor &&
      actorCanMutateResource(item, requiredLevel, permissionContext),
    getMemberItemPermissionLevel: (item, participantId) =>
      getMemberResourcePermissionLevel(item, participantId, getItemById),
  }
}
