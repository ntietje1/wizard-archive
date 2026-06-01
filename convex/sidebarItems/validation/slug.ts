import { assertSidebarItemSlug as assertSharedSidebarItemSlug } from '../../../shared/sidebar-items/slug'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { SidebarItemSlug } from '../../../shared/sidebar-items/slug'

export function assertSidebarItemSlug(value: string): SidebarItemSlug {
  try {
    return assertSharedSidebarItemSlug(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid slug',
    )
  }
}
