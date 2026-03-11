import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { requireRunMutationCtx } from '@convex-dev/better-auth/utils'
import { multiSession, twoFactor } from 'better-auth/plugins'
import { findUniqueSlug } from './common/slug'
import authConfig from './auth.config'
import {
  changeEmailConfirmationEmail,
  deleteAccountVerificationEmail,
  passwordResetEmail,
  resend,
  verificationEmail,
} from './email'
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

        const updates: Partial<{
          name: string | undefined
          email: string | undefined
          imageUrl: string | undefined
        }> = {}
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
      enabled: true,
      requireEmailVerification: true,
      async sendResetPassword({ user, url }) {
        await resend.sendEmail(
          requireRunMutationCtx(ctx),
          passwordResetEmail(user.email, url),
        )
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      async sendVerificationEmail({ user, url }) {
        await resend.sendEmail(
          requireRunMutationCtx(ctx),
          verificationEmail(user.email, url),
        )
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        async sendDeleteAccountVerification({ user, url }) {
          await resend.sendEmail(
            requireRunMutationCtx(ctx),
            deleteAccountVerificationEmail(user.email, url),
          )
        },
      },
      changeEmail: {
        enabled: true,
        async sendChangeEmailVerification({ user, newEmail, url }) {
          await resend.sendEmail(
            requireRunMutationCtx(ctx),
            changeEmailConfirmationEmail(user.email, newEmail, url),
          )
        },
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    plugins: [convex({ authConfig }), twoFactor(), multiSession()],
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
