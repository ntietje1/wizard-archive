import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { ensureBlocksPersisted } from '../blocks/functions/ensureBlocksPersisted'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { setNoteContent as setNoteContentFn } from './functions/noteCompanion'

export const persistNoteBlocks = campaignMutation({
  args: {
    documentId: v.id('sidebarItems'),
  },
  returns: v.null(),
  handler: async (ctx, { documentId }) => {
    await checkYjsWriteAccess(ctx, documentId)
    await ensureBlocksPersisted(ctx, { noteId: documentId })

    return null
  },
})

export const setNoteContent = campaignMutation({
  args: {
    noteId: v.id('sidebarItems'),
    content: v.array(customBlockValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await checkYjsWriteAccess(ctx, args.noteId)
    await setNoteContentFn(ctx, { noteId: args.noteId, content: args.content })
    return null
  },
})
