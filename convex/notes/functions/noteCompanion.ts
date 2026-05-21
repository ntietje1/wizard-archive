import { internal } from '../../_generated/api'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { copyYjsUpdates } from '../../yjsSync/functions/copyYjsUpdates'
import { syncNoteDerivedDataFromPersistedBlocks } from './syncNoteDerivedData'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Block } from '../../blocks/types'

export async function createNoteCompanion(
  ctx: CampaignMutationCtx,
  {
    noteId,
  }: {
    noteId: Id<'sidebarItems'>
  },
): Promise<void> {
  await ctx.db.insert('notes', {
    sidebarItemId: noteId,
  })

  await createYjsDocument(ctx, { documentId: noteId })

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.created,
  })
}

async function copyNoteBlocks(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
): Promise<Array<Block>> {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('noteId', sourceItemId),
    )
    .collect()

  const blocksInParentOrder = [...blocks].sort(
    (a, b) => a.depth - b.depth || (a.position ?? 0) - (b.position ?? 0),
  )
  const sourceBlockNoteIds = new Set(blocks.map((block) => block.blockNoteId))
  const copiedBlocks: Array<Block> = []

  for (const block of blocksInParentOrder) {
    const {
      _id,
      _creationTime,
      noteId: _sourceNoteId,
      campaignId: _sourceCampaignId,
      shareStatus: _sourceShareStatus,
      parentBlockId,
      ...blockFields
    } = block
    const blockId = await ctx.db.insert('blocks', {
      ...blockFields,
      noteId: targetItemId,
      parentBlockId: parentBlockId && sourceBlockNoteIds.has(parentBlockId) ? parentBlockId : null,
      campaignId: ctx.campaign._id,
      shareStatus: SHARE_STATUS.NOT_SHARED,
    })
    const copiedBlock = await ctx.db.get('blocks', blockId)
    if (!copiedBlock) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Failed to load copied note block')
    }
    copiedBlocks.push(copiedBlock)
  }

  return copiedBlocks
}

export async function copyNoteCompanion(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const targetItem = await ctx.db.get('sidebarItems', targetItemId)
  if (!targetItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Note target item not found')
  if (targetItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note companion requires a note item')
  }
  const existingNote = await ctx.db
    .query('notes')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', targetItemId))
    .unique()
  if (existingNote) {
    throwClientError(ERROR_CODE.CONFLICT, 'Note companion already exists')
  }
  await ctx.db.insert('notes', { sidebarItemId: targetItemId })
  const copiedBlocks = await copyNoteBlocks(ctx, sourceItemId, targetItemId)
  await copyYjsUpdates(ctx, sourceItemId, targetItemId)
  await syncNoteDerivedDataFromPersistedBlocks(ctx, {
    noteId: targetItemId,
    blocks: copiedBlocks,
  })
  await ctx.scheduler.runAfter(0, internal.notes.internalActions.persistNoteBlocksFromYjs, {
    documentId: targetItemId,
  })
}
