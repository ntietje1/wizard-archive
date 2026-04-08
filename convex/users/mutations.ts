import { v } from 'convex/values'
import { authMutation } from '../functions'
import { slugify, validateUsername } from '../common/slug'
import { ERROR_CODE, throwClientError } from '../errors'
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
      throwClientError(ERROR_CODE.VALIDATION_FAILED, validationError)
    }

    if (username === ctx.user.profile.username) {
      return username
    }

    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique()

    if (existing && existing._id !== ctx.user.profile._id) {
      throwClientError(ERROR_CODE.CONFLICT, 'Username is already taken')
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
    if (!url) {
      throwClientError(
        ERROR_CODE.NOT_FOUND,
        'The uploaded file could not be found',
      )
    }

    await ctx.db.patch(ctx.user.profile._id, {
      profileImage: { type: 'storage', storageId: args.storageId },
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
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Name cannot be empty')
    }
    if (name.length > 100) {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Name must be at most 100 characters',
      )
    }
    if (name === ctx.user.profile.name) {
      return null
    }

    await ctx.db.patch(ctx.user.profile._id, { name })
    return null
  },
})
