import { Resend } from '@convex-dev/resend'
import { components } from './_generated/api'

export const resend = new Resend(components.resend, {
  testMode: process.env.RESEND_TEST_MODE === 'true',
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const APP_NAME = 'Wizard Archive'
const FROM_EMAIL = 'Wizard Archive <noreply@email.wizardarchive.com>'

function emailLayout(content: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="margin: 0; color: #1a1a1a;">${APP_NAME}</h2>
      </div>
      ${content}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          You received this email because you have an account with ${APP_NAME}.
        </p>
      </div>
    </div>
  `
}

function actionButton(url: string, label: string) {
  const isProd = process.env.SITE_URL?.startsWith('https://')
  if (isProd && !url.startsWith('https://')) {
    throw new Error('Action button URL must use HTTPS')
  }
  const safeUrl = escapeHtml(url)
  const safeLabel = escapeHtml(label)
  return `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${safeUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        ${safeLabel}
      </a>
    </div>
  `
}

export function passwordResetEmail(to: string, url: string) {
  return {
    from: FROM_EMAIL,
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: emailLayout(`
      <p style="color: #333; line-height: 1.6;">
        We received a request to reset your password. Click the button below to choose a new password.
      </p>
      ${actionButton(url, 'Reset Password')}
      <p style="color: #666; font-size: 13px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email. The link will expire shortly.
      </p>
    `),
  }
}

export function verificationEmail(to: string, url: string) {
  return {
    from: FROM_EMAIL,
    to,
    subject: `Verify your ${APP_NAME} email`,
    html: emailLayout(`
      <p style="color: #333; line-height: 1.6;">
        Thanks for signing up! Please verify your email address to get started.
      </p>
      ${actionButton(url, 'Verify Email')}
      <p style="color: #666; font-size: 13px; line-height: 1.5;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    `),
  }
}

export function deleteAccountVerificationEmail(to: string, url: string) {
  return {
    from: FROM_EMAIL,
    to,
    subject: `Confirm account deletion — ${APP_NAME}`,
    html: emailLayout(`
      <p style="color: #333; line-height: 1.6;">
        We received a request to permanently delete your ${APP_NAME} account. This action <strong>cannot be undone</strong> — all your data will be removed.
      </p>
      ${actionButton(url, 'Delete My Account')}
      <p style="color: #666; font-size: 13px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email. The link will expire shortly.
      </p>
    `),
  }
}

export function changeEmailConfirmationEmail(
  currentEmail: string,
  newEmail: string,
  url: string,
) {
  return {
    from: FROM_EMAIL,
    to: newEmail,
    subject: `Confirm email change for ${APP_NAME}`,
    html: emailLayout(`
      <p style="color: #333; line-height: 1.6;">
        A request was made to change your email address to <strong>${escapeHtml(newEmail)}</strong>. Click the button below to confirm this change.
      </p>
      ${actionButton(url, 'Confirm Email Change')}
      <p style="color: #666; font-size: 13px; line-height: 1.5;">
        If you didn't request this change, please secure your account immediately.
      </p>
    `),
  }
}
