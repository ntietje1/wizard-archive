import { ERROR_CODE, throwClientError } from '../../errors'
import { isPermissionRejectionCode } from '../operations/capabilities'
import type { SidebarOperationCapability } from '../operations/capabilities'

export function assertSidebarOperationAllowed(result: SidebarOperationCapability): void {
  if (result.ok) return

  throwClientError(
    isPermissionRejectionCode(result.code)
      ? ERROR_CODE.PERMISSION_DENIED
      : ERROR_CODE.VALIDATION_FAILED,
    result.message,
  )
}
