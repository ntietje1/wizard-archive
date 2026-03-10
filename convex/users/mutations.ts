import { v } from 'convex/values'
import { authMutation } from '../functions'
import { slugify } from '../common/slug'

export const updateUsername = authMutation({
  args: {
    username: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const username = slugify(args.username)

    if (username.length < 2) {
      throw new Error('Username must be at least 2 characters')
    }
    if (username.length > 30) {
      throw new Error('Username must be at most 30 characters')
    }

    if (username === ctx.user.profile.username) {
      return null
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique()

    if (existing && existing._id !== ctx.user.profile._id) {
      throw new Error('Username is already taken')
    }

    await ctx.db.patch(ctx.user.profile._id, { username })
    return null
  },
})

export const updateProfileImage = authMutation({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) throw new Error('Failed to get image URL')

    await ctx.db.patch(ctx.user.profile._id, {
      imageUrl: url,
    })
    return null
  },
})

export const updateName = authMutation({
  args: {
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim()
    if (name.length === 0) {
      throw new Error('Name cannot be empty')
    }
    if (name.length > 100) {
      throw new Error('Name must be at most 100 characters')
    }

    await ctx.db.patch(ctx.user.profile._id, { name })
    return null
  },
})
