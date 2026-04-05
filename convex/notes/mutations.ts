import { v } from 'convex/values'
import { BlockNoteEditor } from '@blocknote/core'
import { yDocToBlocks } from '@blocknote/core/yjs'
import { authMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { saveTopLevelBlocksForNote } from '../blocks/functions/saveTopLevelBlocksForNote'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { reconstructYDoc } from '../yjsSync/functions/reconstructYDoc'
import { EDIT_HISTORY_ACTION } from '../editHistory/types'
import { logEditHistory } from '../editHistory/log'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import { createNote as createNoteFn } from './functions/createNote'
import { updateNote as updateNoteFn } from './functions/updateNote'
import { updateNoteContent as updateNoteContentFn } from './functions/updateNoteContent'
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
    const noteFromDb = await checkYjsWriteAccess(ctx, documentId)

    const { doc } = await reconstructYDoc(ctx, documentId)
    let editor: ReturnType<typeof BlockNoteEditor.create> | undefined
    try {
      editor = BlockNoteEditor.create({
        schema: editorSchema,
        _headless: true,
      })
      const blocks = yDocToBlocks(editor, doc)

      await saveTopLevelBlocksForNote(ctx, {
        noteId: documentId,
        content: blocks,
      })
    } finally {
      doc.destroy()
      editor?._tiptapEditor.destroy()
    }

    // Debounce: skip if the same user edited this note within the last 5 minutes
    const DEBOUNCE_MS = 5 * 60 * 1000
    const recentEntries = await ctx.db
      .query('editHistory')
      .withIndex('by_item', (q) => q.eq('itemId', documentId))
      .order('desc')
      .take(1)
    const lastEntry = recentEntries[0]
    const shouldSkip =
      lastEntry &&
      lastEntry.action === EDIT_HISTORY_ACTION.content_edited &&
      Date.now() - lastEntry._creationTime < DEBOUNCE_MS

    if (!shouldSkip) {
      await logEditHistory(ctx, {
        itemId: documentId,
        itemType: SIDEBAR_ITEM_TYPES.notes,
        campaignId: noteFromDb.campaignId,
        action: EDIT_HISTORY_ACTION.content_edited,
      })
    }

    return null
  },
})

// TODO: remove this (unused)
export const updateNoteContent = authMutation({
  args: {
    noteId: v.id('notes'),
    content: v.array(customBlockValidator),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await updateNoteContentFn(ctx, {
      noteId: args.noteId,
      content: args.content,
    })
  },
})
