import { v } from 'convex/values'
import { authMutation } from '../functions'
import { slugify, validateUsername } from '../common/slug'
import { ERROR_CODE, throwAppError } from '../errors'
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from './constants'

export const updateUsername = authMutation({
  args: {
    username: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const username = slugify(args.username)

    const validationError = validateUsername(
      username,
      args.username,
      USERNAME_MIN_LENGTH,
      USERNAME_MAX_LENGTH,
    )
    if (validationError) {
      throwAppError(ERROR_CODE.VALIDATION_USERNAME_TOO_SHORT, validationError)
    }

    if (username === ctx.user.profile.username) {
      return username
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique()

    if (existing && existing._id !== ctx.user.profile._id) {
      throwAppError(
        ERROR_CODE.CONFLICT_USERNAME_TAKEN,
        'Username is already taken',
      )
    }

    await ctx.db.patch(ctx.user.profile._id, { username })
    return username
  },
})

export const updateProfileImage = authMutation({
  args: {
    storageId: v.id('_storage'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) throw new Error('Invalid storage ID')

    // Clear external imageUrl (e.g. from OAuth) in favor of the storage file.
    // The URL is resolved at query time via resolveProfileImageUrl.
    await ctx.db.patch(ctx.user.profile._id, {
      imageStorageId: args.storageId,
      imageUrl: null,
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
    if (name === ctx.user.profile.name) {
      return null
    }

    await ctx.db.patch(ctx.user.profile._id, { name })
    return null
  },
})
