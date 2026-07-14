import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { NoteItemRow } from '@wizard-archive/editor/notes/item-contract'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'

export async function getBlockShareNote(
  ctx: BlockShareMutationCtx,
  noteId: Id<'sidebarItems'>,
): Promise<NoteItemRow> {
  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem || rawItem.type !== RESOURCE_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }
  return rawItem
}
