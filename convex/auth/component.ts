import { v } from 'convex/values'
import { internalMutation } from '../_generated/server'
import { onCreateUser } from './functions/onCreateUser'
import { onUpdateUser } from './functions/onUpdateUser'
import { onDeleteUser } from './functions/onDeleteUser'

const authUserDocValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  email: v.string(),
  name: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
  emailVerified: v.boolean(),
  twoFactorEnabled: v.optional(v.union(v.boolean(), v.null())),
})

const deletedAuthUserDocValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
})

export const onCreate = internalMutation({
  args: {
    doc: authUserDocValidator,
    model: v.string(),
  },
  handler: async (ctx, { doc, model }) => {
    if (model === 'user') {
      await onCreateUser(ctx, doc)
    }
  },
})

export const onUpdate = internalMutation({
  args: {
    oldDoc: authUserDocValidator,
    newDoc: authUserDocValidator,
    model: v.string(),
  },
  handler: async (ctx, { oldDoc, newDoc, model }) => {
    if (model === 'user') {
      await onUpdateUser(ctx, newDoc, oldDoc)
    }
  },
})

export const onDelete = internalMutation({
  args: {
    doc: deletedAuthUserDocValidator,
    model: v.string(),
  },
  handler: async (ctx, { doc, model }) => {
    if (model === 'user') {
      await onDeleteUser(ctx, doc)
    }
  },
})
