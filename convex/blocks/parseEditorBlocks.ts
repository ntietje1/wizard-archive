import { ERROR_CODE, throwClientError } from '../errors'
import { blockNoteBlockSchema } from './blockSchemas'
import type { CustomBlock } from './types'

const editorBlocksSchema = blockNoteBlockSchema.array()

export function parseEditorBlocks(input: unknown): Array<CustomBlock> {
  const result = editorBlocksSchema.safeParse(input)
  if (!result.success) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      result.error.issues[0]?.message ?? 'Block content is invalid',
    )
  }
  return result.data
}
