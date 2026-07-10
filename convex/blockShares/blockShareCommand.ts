import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'

export const MAX_BLOCK_SHARE_TARGETS = 100

export function normalizeBlockShareTargetIds<T extends string>(blockNoteIds: Array<T>): Array<T> {
  const normalized = [...new Set(blockNoteIds)]
  if (normalized.length > MAX_BLOCK_SHARE_TARGETS) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot update more than ${MAX_BLOCK_SHARE_TARGETS} blocks at once`,
    )
  }
  return normalized
}
