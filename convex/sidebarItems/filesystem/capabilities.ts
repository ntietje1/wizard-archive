import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type {
  OperationActorSnapshot,
  ResourceOperationCapability,
} from '@wizard-archive/editor/resources/operation-capabilities'
import { isResourceOperationPermissionRejection } from '@wizard-archive/editor/resources/operation-capabilities'
import type { CampaignMemberRole } from '../../../shared/campaigns/types'

export function operationActorFromRole(
  role: CampaignMemberRole | null | undefined,
): OperationActorSnapshot {
  const isDm = role === CAMPAIGN_MEMBER_ROLE.DM
  return {
    canCreateRootItems: isDm,
    canManageFolders: isDm,
  }
}

export function assertSidebarOperationAllowed(result: ResourceOperationCapability): void {
  if (result.ok) return
  if (isResourceOperationPermissionRejection(result.code)) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, result.message)
  }
  throwClientError(ERROR_CODE.VALIDATION_FAILED, result.message)
}
