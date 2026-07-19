import { describe, expect, it } from 'vite-plus/test'
import http from './http'
import crons from './crons'
import {
  changeEmailConfirmationEmail,
  deleteAccountVerificationEmail,
  passwordResetEmail,
  verificationEmail,
} from './email'

describe('production Convex entrypoints', () => {
  it('registers every production HTTP route', () => {
    expect(
      http
        .getRoutes()
        .map(([path, method]) => `${method} ${path}`)
        .sort(),
    ).toEqual(
      [
        'GET /.well-known/openid-configuration',
        'GET /api/auth/*',
        'OPTIONS /api/auth/*',
        'POST /api/auth/*',
        'POST /resend-webhook',
      ].sort(),
    )
  })

  it('registers every production cron', () => {
    const cronExport = crons as unknown as { export: () => string }
    const registeredCrons = JSON.parse(cronExport.export()) as Record<string, unknown>
    expect(Object.keys(registeredCrons)).toEqual([
      'purge expired auth sessions and verification tokens',
    ])
  })

  it('renders every production email template', () => {
    process.env.VITE_SITE_URL = 'https://wizardarchive.com'
    const templates = [
      passwordResetEmail('user@example.com', 'https://wizardarchive.com/reset'),
      verificationEmail('user@example.com', 'https://wizardarchive.com/verify'),
      deleteAccountVerificationEmail('user@example.com', 'https://wizardarchive.com/delete'),
      changeEmailConfirmationEmail(
        'old@example.com',
        'new@example.com',
        'https://wizardarchive.com/change-email',
      ),
    ]
    expect(templates).toHaveLength(4)
    expect(
      templates.every((template) => template.html.includes('https://wizardarchive.com/')),
    ).toBe(true)
  })
})
