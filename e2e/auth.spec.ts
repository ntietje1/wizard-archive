import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth-helpers'

test.use({ storageState: { cookies: [], origins: [] } })

test('sign in with valid credentials redirects to campaigns', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  await page.goto('/sign-in', { waitUntil: 'networkidle' })
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/campaigns/, { timeout: 15000 })
})

test('sign in with wrong credentials shows error', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' })
  await signIn(page, 'wrong@example.com', 'badpassword')
  await expect(page.getByText(/invalid|incorrect|unable|error/i)).toBeVisible({
    timeout: 10000,
  })
})

test('protected route requires authentication', async ({ page }) => {
  await page.goto('/campaigns', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible()
})
