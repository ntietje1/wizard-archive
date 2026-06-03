import type { Page } from '@playwright/test'

export async function signIn(page: Page, email: string, password: string) {
  await page.waitForFunction(() => '__TSR_ROUTER__' in window, undefined, { timeout: 30000 })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

export async function signInByApi(page: Page, email: string, password: string) {
  const origin = new URL(page.url()).origin
  const response = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password },
    headers: {
      Origin: origin,
      Referer: `${origin}/sign-in`,
    },
  })

  if (!response.ok()) {
    throw new Error(`E2E sign-in failed with ${response.status()}: ${await response.text()}`)
  }

  await page.goto('/campaigns')
}
