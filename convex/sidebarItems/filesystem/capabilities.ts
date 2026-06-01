import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { isPermissionRejectionCode } from '../../../shared/sidebar-items/filesystem/capabilities'
import type { SidebarOperationCapability } from '../../../shared/sidebar-items/filesystem/capabilities'

export function assertSidebarOperationAllowed(result: SidebarOperationCapability): void {
  if (result.ok) return
  if (isPermissionRejectionCode(result.code)) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, result.message)
  }
  throwClientError(ERROR_CODE.VALIDATION_FAILED, result.message)
}
