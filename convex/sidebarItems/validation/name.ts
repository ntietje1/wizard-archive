import { assertResourceName } from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceName } from '@wizard-archive/editor/resources/resource-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
export function assertConvexSidebarItemName(name: string): ResourceName {
  try {
    return assertResourceName(name)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid sidebar item name',
    )
  }
}
