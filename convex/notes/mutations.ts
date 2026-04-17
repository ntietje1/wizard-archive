import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { ensureBlocksPersisted } from '../blocks/functions/ensureBlocksPersisted'
import { checkYjsWriteAccess } from '../yjsSync/functions/checkYjsAccess'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/createParentTarget'
import {
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
import { requireSidebarItemName } from '../sidebarItems/sharedValidation'
import { createNote as createNoteFn } from './functions/createNote'
import { updateNote as updateNoteFn } from './functions/updateNote'
import type { Id } from '../_generated/dataModel'

export const updateNote = campaignMutation({
  args: {
    noteId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    noteId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    return await updateNoteFn(ctx, {
      noteId: args.noteId,
      name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createNote = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    content: v.optional(v.array(customBlockValidator)),
  },
  returns: v.object({
    noteId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    return await createNoteFn(ctx, {
      name,
      parentTarget,
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
