import { v } from 'convex/values'
import { authMutation } from '../functions'
import { assertUsername, usernameValidator } from './validation'
import { ERROR_CODE } from '../../shared/errors/client'
import { throwClientError } from '../errors'
import { commitUpload } from '../storage/functions/commitUpload'

export const updateUsername = authMutation({
  args: {
    username: usernameValidator,
  },
  returns: usernameValidator,
  handler: async (ctx, args) => {
    const username = assertUsername(args.username)

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
    uploadSessionId: v.id('fileStorage'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await commitUpload(ctx, { sessionId: args.uploadSessionId })

    await ctx.db.patch('userProfiles', ctx.user.profile._id, {
      profileImage: { type: 'storage', storageId: upload.storageId },
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
