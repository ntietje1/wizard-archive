import { assertSidebarItemName as assertSharedSidebarItemName } from '../../../shared/sidebar-items/name'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'

export function assertSidebarItemName(name: string): SidebarItemName {
  try {
    return assertSharedSidebarItemName(name)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid sidebar item name',
    )
  }
}
