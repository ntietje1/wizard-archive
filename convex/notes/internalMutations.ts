import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { customBlockValidator } from '../blocks/schema'
import { yjsDocumentIdValidator } from '../yjsSync/schema'
import { saveTopLevelBlocksForNote } from '../blocks/functions/saveTopLevelBlocksForNote'
import { authenticate } from '../functions'
import type { CustomBlock } from './editorSpecs'

export const saveNoteBlocksInternal = internalMutation({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  handler: async (ctx, { noteId, content }) => {
    const user = await authenticate(ctx)
    await saveTopLevelBlocksForNote(
      { ...ctx, user },
      { noteId, content: content as Array<CustomBlock> },
    )
  },
})

export const pushYjsUpdateInternal = internalMutation({
  args: {
    documentId: yjsDocumentIdValidator,
    update: v.bytes(),
  },
  handler: async (ctx, { documentId, update }) => {
    const latest = await ctx.db
      .query('yjsUpdates')
      .withIndex('by_document_seq', (q) => q.eq('documentId', documentId))
      .order('desc')
      .first()

    const seq = (latest?.seq ?? -1) + 1

    await ctx.db.insert('yjsUpdates', {
      documentId,
      update,
      seq,
      isSnapshot: false,
    })
  },
})
