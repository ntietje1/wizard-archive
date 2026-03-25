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
import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL
if (!siteUrl) {
  throw new Error('SITE_URL environment variable is required')
}
const authFunctions: AuthFunctions = internal.auth

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
if (!googleClientId || !googleClientSecret) {
  throw new Error(
    'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required',
  )
}

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
          email: user.email ?? null,
          emailVerified: user.emailVerified ?? null,
          name: user.name ?? null,
          imageUrl: user.image ?? null,
          imageStorageId: null,
          twoFactorEnabled: user.twoFactorEnabled ?? null,
        })
      },
      onUpdate: async (ctx, newUser, oldUser) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', (q) => q.eq('authUserId', String(newUser._id)))
          .unique()
        if (!profile) return

        const updates: Partial<{
          name: string | null
          email: string | null
          emailVerified: boolean | null
          imageUrl: string | null
          twoFactorEnabled: boolean | null
        }> = {}
        if (newUser.name !== oldUser.name) updates.name = newUser.name ?? null
        if (newUser.email !== oldUser.email)
          updates.email = newUser.email ?? null
        if (newUser.emailVerified !== oldUser.emailVerified)
          updates.emailVerified = newUser.emailVerified ?? null
        if (newUser.image !== oldUser.image)
          updates.imageUrl = newUser.image ?? null
        if (newUser.twoFactorEnabled !== oldUser.twoFactorEnabled)
          updates.twoFactorEnabled = newUser.twoFactorEnabled ?? null

        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(profile._id, updates)
        }
      },
      onDelete: async (ctx, user) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_user', (q) => q.eq('authUserId', String(user._id)))
          .unique()
        if (!profile) return

        const profileId = profile._id
        const now = Date.now()

        // Clean up user-scoped data before deleting the profile

        // 1. Hard delete userPreferences
        const prefs = await ctx.db
          .query('userPreferences')
          .withIndex('by_user', (q) => q.eq('userId', profileId))
          .collect()

        // 2. Hard delete editor records
        const editors = await ctx.db
          .query('editor')
          .withIndex('by_user', (q) => q.eq('userId', profileId))
          .collect()

        // 3. Hard delete fileStorage records and underlying storage files
        const files = await ctx.db
          .query('fileStorage')
          .withIndex('by_user_storage', (q) => q.eq('userId', profileId))
          .collect()

        await Promise.all([
          ...prefs.map((p) => ctx.db.delete(p._id)),
          ...editors.map((e) => ctx.db.delete(e._id)),
          ...files.map(async (f) => {
            await ctx.storage.delete(f.storageId)
            await ctx.db.delete(f._id)
          }),
        ])

        // 4. Soft-delete campaign memberships and DM-owned campaigns
        const memberships = await ctx.db
          .query('campaignMembers')
          .withIndex('by_user', (q) => q.eq('userId', profileId))
          .collect()

        for (const member of memberships) {
          if (member.deletionTime) continue

          // If user is DM, soft-delete the campaign
          const campaign = await ctx.db.get(member.campaignId)
          if (
            campaign &&
            !campaign.deletionTime &&
            campaign.dmUserId === profileId
          ) {
            await ctx.db.patch(campaign._id, {
              deletionTime: now,
              deletedBy: profileId,
              updatedTime: now,
              updatedBy: profileId,
            })
          }

          // Soft-delete the membership
          await ctx.db.patch(member._id, {
            deletionTime: now,
            deletedBy: profileId,
            updatedTime: now,
            updatedBy: profileId,
          })
        }

        // 5. Delete the profile itself
        await ctx.db.delete(profileId)
      },
    },
  },
})

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days (default: 7 days)
      updateAge: 60 * 60 * 24 * 7, // refresh every 7 days (default: 1 day)
      cookieCache: {
        enabled: true,
        maxAge: 60 * 10, // cache session for 10 minutes before re-checking DB
      },
    },
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
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        if (user.emailVerified) return
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
        async sendChangeEmailConfirmation({ user, newEmail, url }) {
          await resend.sendEmail(
            requireRunMutationCtx(ctx),
            changeEmailConfirmationEmail(user.email, newEmail, url),
          )
        },
      },
    },
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    },
    plugins: [convex({ authConfig }), twoFactor(), multiSession()],
  })
}

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()
