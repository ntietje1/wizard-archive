import * as Y from 'yjs'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { copyYjsUpdates } from '../../yjsSync/functions/copyYjsUpdates'
import { blocksToYDoc } from '../blocknote'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'
import type { BlockNoteId } from '../../blocks/types'

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
) {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('noteId', sourceItemId),
    )
    .collect()

  const blockNoteIdMap = new Map<BlockNoteId, BlockNoteId>()
  for (const block of blocks) {
    blockNoteIdMap.set(block.blockNoteId, crypto.randomUUID() as BlockNoteId)
  }

  await Promise.all(
    blocks.map((block) => {
      const blockNoteId = blockNoteIdMap.get(block.blockNoteId)
      if (!blockNoteId) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Failed to remap duplicated note block')
      }
      let parentBlockId: BlockNoteId | null = null
      if (block.parentBlockId) {
        const mappedParentBlockId = blockNoteIdMap.get(block.parentBlockId)
        if (!mappedParentBlockId) {
          throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Failed to remap parent note block')
        }
        parentBlockId = mappedParentBlockId
      }
      return ctx.db.insert('blocks', {
        noteId: targetItemId,
        blockNoteId,
        position: block.position,
        parentBlockId,
        depth: block.depth,
        type: block.type,
        props: block.props,
        inlineContent: block.inlineContent,
        plainText: block.plainText,
        campaignId: ctx.campaign._id,
        shareStatus: block.shareStatus,
      })
    }),
  )
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
  await copyNoteBlocks(ctx, sourceItemId, targetItemId)
  await copyYjsUpdates(ctx, sourceItemId, targetItemId)
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

  const persistedBlocks = await saveAllBlocksForNote(ctx, { noteId, content })
  await syncNoteLinks(ctx, {
    noteId,
    campaignId: ctx.campaign._id,
    blocks: persistedBlocks,
  })
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
