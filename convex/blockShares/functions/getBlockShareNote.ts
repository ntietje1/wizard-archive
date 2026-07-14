import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Doc, Id } from '../../_generated/dataModel'

export async function getBlockShareNote(
  ctx: BlockShareMutationCtx,
  noteId: Id<'sidebarItems'>,
): Promise<Doc<'sidebarItems'>> {
  const rawItem = await ctx.db.get('sidebarItems', noteId)
  if (!rawItem || rawItem.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }
  return rawItem
}
