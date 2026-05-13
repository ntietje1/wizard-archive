import * as Y from 'yjs'
import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { createYjsDocument } from '../../yjsSync/functions/createYjsDocument'
import { uint8ToArrayBuffer } from '../../yjsSync/functions/uint8ToArrayBuffer'
import { blocksToYDoc } from '../blocknote'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../editorSpecs'

export async function createNoteCompanion(
  ctx: CampaignMutationCtx,
  {
    noteId,
    content,
  }: {
    noteId: Id<'sidebarItems'>
    content?: Array<CustomBlock>
  },
): Promise<void> {
  const sidebarItem = await ctx.db.get(noteId)
  if (!sidebarItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Note sidebar item not found')
  if (sidebarItem.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note companion requires a note sidebar item')
  }
  const existingNote = await ctx.db
    .query('notes')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', noteId))
    .unique()
  if (existingNote) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Note companion already exists')
  }

  await ctx.db.insert('notes', {
    sidebarItemId: noteId,
  })

  let initialState: ArrayBuffer | undefined
  if (content && content.length > 0) {
    const persistedBlocks = await saveAllBlocksForNote(ctx, { noteId, content })
    await syncNoteLinks(ctx, {
      noteId,
      campaignId: ctx.campaign._id,
      blocks: persistedBlocks,
    })

    const doc = blocksToYDoc(content, 'document')
    try {
      initialState = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
    } finally {
      doc.destroy()
    }
  }

  await createYjsDocument(ctx, { documentId: noteId, initialState })

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.created,
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
  const sidebarItem = await ctx.db.get(noteId)
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
