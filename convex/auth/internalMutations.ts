import { components } from '../_generated/api'
import { internalMutation } from '../_generated/server'

export const purgeExpiredAuthData = internalMutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const now = Date.now()

    // Delete expired sessions
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: 'session',
        where: [{ field: 'expiresAt', operator: 'lt', value: now }],
      },
    })

    // Delete expired verification tokens
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: 'verification',
        where: [{ field: 'expiresAt', operator: 'lt', value: now }],
      },
    })
  },
})
