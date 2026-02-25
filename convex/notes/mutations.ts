import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { createNote as createNoteFn } from './functions/createNote'
import { updateNote as updateNoteFn } from './functions/updateNote'
import { moveNote as moveNoteFn } from './functions/moveNote'
import { deleteNote as deleteNoteFn } from './functions/deleteNote'
import { updateNoteContent as updateNoteContentFn } from './functions/updateNoteContent'
import type { Id } from '../_generated/dataModel'

export const updateNote = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
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

export const moveNote = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await moveNoteFn(ctx, {
      noteId: args.noteId,
      parentId: args.parentId,
    })
  },
})

export const deleteNote = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    noteId: v.id('notes'),
  },
  returns: v.id('notes'),
  handler: async (ctx, args): Promise<Id<'notes'>> => {
    return await deleteNoteFn(ctx, { noteId: args.noteId })
  },
})

export const createNote = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.optional(v.id('folders')),
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
    })
  },
})

export const updateNoteContent = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
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
