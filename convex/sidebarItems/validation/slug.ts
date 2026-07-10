import { assertResourceSlug } from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceSlug } from '@wizard-archive/editor/resources/resource-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
export function assertConvexSidebarItemSlug(value: string): ResourceSlug {
  try {
    return assertResourceSlug(value)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid slug',
    )
  }
}
