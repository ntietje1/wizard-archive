import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function signIn(page: Page, email: string, password: string) {
  await waitForAppHydrated(page)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

export async function gotoSignIn(page: Page) {
  await page.goto('/sign-in', { waitUntil: 'commit' })
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible({ timeout: 30000 })
  await waitForAppHydrated(page)
}

export async function signInByApi(page: Page, email: string, password: string) {
  const origin = getAppOrigin(page)
  let lastError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: { email, password },
        headers: {
          Origin: origin,
          Referer: `${origin}/sign-in`,
        },
        timeout: 60000,
      })

      if (!response.ok()) {
        throw new Error(`E2E sign-in failed with ${response.status()}: ${await response.text()}`)
      }
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(1000)
    }
  }

  throw lastError
}

function getAppOrigin(page: Page) {
  try {
    const currentUrl = new URL(page.url())
    if (currentUrl.protocol === 'http:' || currentUrl.protocol === 'https:') {
      return currentUrl.origin
    }
  } catch {
    // about:blank is expected for API-only setup contexts.
  }

  return process.env.VITE_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
}

async function waitForAppHydrated(page: Page) {
  await page.waitForFunction(
    () => {
      const win = window as typeof window & {
        $_TSR?: unknown
        __TSR_ROUTER__?: unknown
      }
      return Boolean(win.__TSR_ROUTER__) && win.$_TSR === undefined
    },
    undefined,
    { timeout: 60000 },
  )
}
