import { ERROR_CODE } from '../../shared/errors/client'
import {
  noteBlockSchema,
  migrateLegacyMediaBlocks,
} from '@wizard-archive/editor/notes/document-contract'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { throwClientError } from '../errors'

const blockNoteBlocksSchema = noteBlockSchema.array()

export function parseBlockNoteBlocks(input: unknown): Array<NoteBlock> {
  const normalizedInput = Array.isArray(input) ? migrateLegacyMediaBlocks(input) : input
  const result = blockNoteBlocksSchema.safeParse(normalizedInput)
  if (!result.success) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      result.error.issues[0]?.message ?? 'Block content is invalid',
    )
  }
  return result.data
}
