import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
export function assertConvexResourceTitle(name: string): ResourceTitle {
  try {
    return canonicalizeResourceTitle(name)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid resource title',
    )
  }
}
