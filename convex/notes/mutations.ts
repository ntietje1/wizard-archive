import { v } from 'convex/values'
import { BlockNoteEditor } from '@blocknote/core'
import { yDocToBlocks } from '@blocknote/core/yjs'
import { authMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { saveTopLevelBlocksForNote } from '../blocks/functions/saveTopLevelBlocksForNote'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { reconstructYDoc } from '../yjsSync/functions/reconstructYDoc'
import { createNote as createNoteFn } from './functions/createNote'
import { updateNote as updateNoteFn } from './functions/updateNote'
import { editorSchema } from './editorSpecs'
import type { Id } from '../_generated/dataModel'

export const updateNote = authMutation({
  args: {
    noteId: v.id('notes'),
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
    return await updateNoteFn(ctx, {
      noteId: args.noteId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createNote = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.union(v.id('folders'), v.null()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    content: v.optional(v.array(customBlockValidator)),
  },
  returns: v.object({
    noteId: v.id('notes'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ noteId: Id<'notes'>; slug: string }> => {
    return await createNoteFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      content: args.content,
      campaignId: args.campaignId,
    })
  },
})

export const persistNoteBlocks = authMutation({
  args: {
    documentId: v.id('notes'),
  },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await checkYjsWriteAccess(ctx, documentId)

    const { doc } = await reconstructYDoc(ctx, documentId)
    let editor: ReturnType<typeof BlockNoteEditor.create> | undefined
    try {
      editor = BlockNoteEditor.create({
        schema: editorSchema,
        _headless: true,
      })
      const blocks = yDocToBlocks(editor, doc, 'document')

      await saveTopLevelBlocksForNote(ctx, {
        noteId: documentId,
        content: blocks,
      })
    } finally {
      doc.destroy()
      editor?._tiptapEditor.destroy()
    }

    return null
  },
})
