import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { WorkspaceMode } from '../../../../shared/workspace/workspace-mode'
import type { CampaignMemberId } from '../resources/domain-id'
import type { AnyItem } from '../workspace/items'

export interface FileSystemPermissions {
  workspaceMode: WorkspaceMode
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  canEdit: boolean
  canCreateItems: boolean
  canEmptyTrash: boolean
  canManageFolders: boolean
  canAccessItem: (item: AnyItem, requiredLevel: PermissionLevel) => boolean
  canMutateItem: (item: AnyItem, requiredLevel: PermissionLevel) => boolean
  getMemberItemPermissionLevel: (item: AnyItem, participantId: CampaignMemberId) => PermissionLevel
}
