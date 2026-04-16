import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { ensureBlocksPersisted } from '../blocks/functions/ensureBlocksPersisted'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import { createNote as createNoteFn } from './functions/createNote'
import { updateNote as updateNoteFn } from './functions/updateNote'
import type { Id } from '../_generated/dataModel'

export const updateNote = campaignMutation({
  args: {
    noteId: v.id('sidebarItems'),
    name: v.optional(v.string()),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    noteId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> => {
    return await updateNoteFn(ctx, {
      noteId: args.noteId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createNote = campaignMutation({
  args: {
    name: v.string(),
    parentId: v.nullable(v.id('sidebarItems')),
    parentPath: v.optional(v.array(v.string())),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    content: v.optional(v.array(customBlockValidator)),
  },
  returns: v.object({
    noteId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> => {
    return await createNoteFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      parentPath: args.parentPath,
      iconName: args.iconName,
      color: args.color,
      content: args.content,
    })
  },
})

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
