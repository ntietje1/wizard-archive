import { v } from 'convex/values'
import { authMutation } from '../functions'
import { usernameValidator, validateUsername } from './validation'
import { ERROR_CODE, throwClientError } from '../errors'

export const updateUsername = authMutation({
  args: {
    username: usernameValidator,
  },
  returns: usernameValidator,
  handler: async (ctx, args) => {
    const username = args.username
    const validationError = validateUsername(username)
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

    await ctx.db.patch('userProfiles', ctx.user.profile._id, { username })
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
      throwClientError(ERROR_CODE.NOT_FOUND, 'The uploaded file could not be found')
    }

    await ctx.db.patch('userProfiles', ctx.user.profile._id, {
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
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Name must be at most 100 characters')
    }
    if (name === ctx.user.profile.name) {
      return null
    }

    await ctx.db.patch('userProfiles', ctx.user.profile._id, { name })
    return null
  },
})
