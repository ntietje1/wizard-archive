import { yjsUpdatesToBlocks } from '../blocknoteNode'
import { syncNoteIndexesFromBlocks } from './syncNoteDerivedData'
import { ERROR_CODE, throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

type ProjectNoteBlocksCtx = Pick<MutationCtx, 'db'> & {
  campaign?: Pick<Doc<'campaigns'>, '_id'>
}

export async function projectNoteBlocksFromYjsInMutation(
  ctx: ProjectNoteBlocksCtx,
  documentId: Id<'sidebarItems'>,
): Promise<void> {
  const note = await ctx.db.get('sidebarItems', documentId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item is not a note')
  }
  const campaign = ctx.campaign ?? (await ctx.db.get('campaigns', note.campaignId))
  if (!campaign) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')

  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
    .order('asc')
    .collect()

  await syncNoteIndexesFromBlocks(
    { ...ctx, campaign },
    {
      noteId: documentId,
      content: yjsUpdatesToBlocks(updates),
    },
  )
}
