import { ERROR_CODE } from '../../shared/errors/client'
import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import { throwClientError } from '../errors'
import type { NoteBlockId } from '@wizard-archive/editor/resources/domain-id'

export const MAX_BLOCK_SHARE_TARGETS = 100

export function normalizeBlockShareTargetIds(
  blockNoteIds: ReadonlyArray<string>,
): Array<NoteBlockId> {
  const normalized = [...new Set(blockNoteIds)]
  if (normalized.length > MAX_BLOCK_SHARE_TARGETS) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot update more than ${MAX_BLOCK_SHARE_TARGETS} blocks at once`,
    )
  }
  return normalized.map((blockNoteId) => {
    const parsed = parseDomainId(DOMAIN_ID_KIND.noteBlock, blockNoteId)
    if (!parsed) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Block IDs must be lowercase UUIDv7 values')
    }
    return parsed
  })
}
