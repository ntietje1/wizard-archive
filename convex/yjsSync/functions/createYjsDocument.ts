import * as Y from 'yjs'
import { BlockNoteEditor } from '@blocknote/core'
import { blocksToYDoc } from '@blocknote/core/yjs'
import { editorSchema } from '../../notes/editorSpecs'
import { uint8ToArrayBuffer } from './uint8ToArrayBuffer'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { CustomBlock } from '../../notes/editorSpecs'

export async function createYjsDocument(
  ctx: MutationCtx,
  {
    noteId,
    content,
  }: {
    noteId: Id<'notes'>
    content: Array<CustomBlock> | null
  },
) {
  let update: ArrayBuffer
  if (content && content.length > 0) {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      _headless: true,
    })
    const doc = blocksToYDoc(editor, content)
    update = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
    doc.destroy()
    editor._tiptapEditor.destroy()
  } else {
    const doc = new Y.Doc()
    doc.getXmlFragment('document')
    update = uint8ToArrayBuffer(Y.encodeStateAsUpdate(doc))
    doc.destroy()
  }

  const existing = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) =>
      q.eq('documentId', noteId).eq('seq', 0),
    )
    .first()

  if (!existing) {
    await ctx.db.insert('yjsUpdates', {
      documentId: noteId,
      update,
      seq: 0,
      isSnapshot: true,
    })
  }
}
