import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { twoFactor } from 'better-auth/plugins'
import { v } from 'convex/values'
import { findUniqueSlug } from './common/slug'
import authConfig from './auth.config'
import { components, internal } from './_generated/api'
import { query } from './_generated/server'
import { userValidator } from './users/schema'
import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL!

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        const baseUsername =
          (user.email ? user.email.split('@')[0] : undefined) ||
          user.name?.toLowerCase().replace(/\s+/g, '') ||
          `user${String(user._id).slice(-8)}`

        const username = await findUniqueSlug(baseUsername, async (slug) => {
          const conflict = await ctx.db
            .query('userProfiles')
            .withIndex('by_username', (q) => q.eq('username', slug))
            .unique()
          return conflict !== null
        })

        await ctx.db.insert('userProfiles', {
          authUserId: String(user._id),
          username,
          email: user.email,
          name: user.name,
          imageUrl: user.image ?? undefined,
        })
      },
      onUpdate: async (ctx, newUser, oldUser) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', (q) => q.eq('authUserId', String(newUser._id)))
          .unique()
        if (!profile) return

        const updates: Record<string, string | undefined> = {}
        if (newUser.name !== oldUser.name) updates.name = newUser.name
        if (newUser.email !== oldUser.email) updates.email = newUser.email
        if (newUser.image !== oldUser.image)
          updates.imageUrl = newUser.image ?? undefined

        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(profile._id, updates)
        }
      },
      onDelete: async (ctx, user) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', (q) => q.eq('authUserId', String(user._id)))
          .unique()
        if (profile) {
          await ctx.db.delete(profile._id)
        }
      },
    },
  },
})

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      // TODO: require email verification
      enabled: true,
      requireEmailVerification: false,
      // TODO: integrate Resend for real email delivery
      async sendResetPassword({ user, url }) {
        console.log(`[Auth] Password reset requested for user ${user.id}`)
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [convex({ authConfig }), twoFactor()],
  })
}

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

// TODO: potentially make this return null if not logged in
export const getCurrentUser = query({
  args: {},
  returns: userValidator,
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
