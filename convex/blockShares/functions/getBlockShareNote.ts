import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { NoteFromDb } from '../../../shared/notes/types'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'

export async function getBlockShareNote(
  ctx: BlockShareMutationCtx,
  noteId: Id<'sidebarItems'>,
): Promise<NoteFromDb> {
  const rawItem = await getSidebarItem<'notes'>(ctx, noteId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }
  if (rawItem.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }
  return rawItem
}
