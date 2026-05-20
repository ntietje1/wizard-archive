import * as Y from 'yjs'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { copyYjsUpdates } from '../../yjsSync/functions/copyYjsUpdates'
import { blocksToYDoc } from '../blocknote'
import {
  syncNoteIndexesFromBlocks,
  syncNoteDerivedDataFromPersistedBlocks,
} from './syncNoteDerivedData'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'
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
    const blockId = await ctx.db.insert('blocks', {
      noteId: targetItemId,
      blockNoteId: block.blockNoteId,
      position: block.position,
      parentBlockId:
        block.parentBlockId && sourceBlockNoteIds.has(block.parentBlockId)
          ? block.parentBlockId
          : null,
      depth: block.depth,
      type: block.type,
      props: block.props,
      inlineContent: block.inlineContent,
      plainText: block.plainText,
      campaignId: ctx.campaign._id,
      shareStatus: block.shareStatus,
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
}

export async function setNoteContent(
  ctx: CampaignMutationCtx,
  {
    noteId,
    content,
  }: {
    noteId: Id<'sidebarItems'>
    content: Array<CustomBlock>
  },
): Promise<void> {
  const sidebarItem = await ctx.db.get('sidebarItems', noteId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Note sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note content requires a note sidebar item')
  }
  const note = await ctx.db
    .query('notes')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', noteId))
    .unique()
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note companion not found')

  await syncNoteIndexesFromBlocks(ctx, { noteId, content })
  if (content.length === 0) {
    const doc = new Y.Doc()
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
      .order('desc')
      .first()
    try {
      await ctx.db.insert('yjsUpdates', {
        documentId: noteId,
        update: uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc)),
        seq: (latest?.seq ?? -1) + 1,
        isSnapshot: false,
      })
    } finally {
      doc.destroy()
    }
    return
  }

  const doc = blocksToYDoc(content, 'document')
  try {
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
      .order('desc')
      .first()
    await ctx.db.insert('yjsUpdates', {
      documentId: noteId,
      update: uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc)),
      seq: (latest?.seq ?? -1) + 1,
      isSnapshot: false,
    })
  } finally {
    doc.destroy()
  }
}
