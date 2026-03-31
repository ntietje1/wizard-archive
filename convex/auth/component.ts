import { betterAuth } from 'better-auth/minimal'
import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { requireRunMutationCtx } from '@convex-dev/better-auth/utils'
import { multiSession, twoFactor } from 'better-auth/plugins'
import authConfig from '../auth.config'
import {
  changeEmailConfirmationEmail,
  deleteAccountVerificationEmail,
  passwordResetEmail,
  resend,
  verificationEmail,
} from '../email'
import { components, internal } from '../_generated/api'
import { onCreateUser } from './functions/onCreateUser'
import { onUpdateUser } from './functions/onUpdateUser'
import { onDeleteUser } from './functions/onDeleteUser'
import type { AuthFunctions, GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from '../_generated/dataModel'

const authFunctions: AuthFunctions = internal.auth.component

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => onCreateUser(ctx, user),
      onUpdate: async (ctx, newUser, oldUser) =>
        onUpdateUser(ctx, newUser, oldUser),
      onDelete: async (ctx, user) => onDeleteUser(ctx, user),
    },
  },
})

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = getRequiredEnv('SITE_URL')

  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const googleProvider =
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}

  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 7,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 10,
      },
      deferSessionRefresh: true,
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
      ...googleProvider,
    },
    plugins: [convex({ authConfig }), twoFactor(), multiSession()],
  })
}

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()
