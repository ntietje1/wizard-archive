import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { PAGE_TYPE } from './types'

export const pageTypeValidator = v.union(
  v.literal(PAGE_TYPE.TEXT),
  v.literal(PAGE_TYPE.MAP),
  v.literal(PAGE_TYPE.CANVAS),
)

export const pageValidator = v.object({
  _id: v.id('pages'),
  _creationTime: v.number(),
  noteId: v.id('notes'),
  title: v.string(),
  slug: v.string(),
  type: pageTypeValidator,
  order: v.number(),
  isReadOnly: v.optional(v.boolean()),
  isDeletable: v.optional(v.boolean()),
})

export const pagesTables = {
  pages: defineTable({
    noteId: v.id('notes'),
    title: v.string(),
    slug: v.string(),
    type: pageTypeValidator,
    order: v.number(),
    isReadOnly: v.optional(v.boolean()),
    isDeletable: v.optional(v.boolean()),
  })
    .index('by_note_order', ['noteId', 'order'])
    .index('by_note_slug', ['noteId', 'slug']),
}
