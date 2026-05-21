'use node'

import { betterAuth } from 'better-auth/minimal'
import { convex } from '@convex-dev/better-auth/plugins'
import { requireRunMutationCtx } from '@convex-dev/better-auth/utils'
import { multiSession } from 'better-auth/plugins/multi-session'
import { twoFactor } from 'better-auth/plugins/two-factor'
import authConfig from '../auth.config'
import {
  changeEmailConfirmationEmail,
  deleteAccountVerificationEmail,
  passwordResetEmail,
  resend,
  verificationEmail,
} from '../email'
import { getAuthBaseUrlConfig } from './authBaseUrl'
import { authComponent } from './componentClient'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from '../_generated/dataModel'

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const baseURL = getAuthBaseUrlConfig(process.env.BETTER_AUTH_ALLOWED_HOSTS)
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET must be set')
  }
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
    secret,
    baseURL,
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
        await resend.sendEmail(requireRunMutationCtx(ctx), passwordResetEmail(user.email, url))
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        if (user.emailVerified) return
        await resend.sendEmail(requireRunMutationCtx(ctx), verificationEmail(user.email, url))
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
