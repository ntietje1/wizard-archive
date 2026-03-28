import { expect, test } from '@playwright/test'
import { signIn } from './helpers/auth-helpers'

test.use({ storageState: { cookies: [], origins: [] } })

test('sign in with valid credentials redirects to campaigns', async ({
  page,
}) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  await page.goto('/sign-in')
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/campaigns/)
})

test('sign in with wrong credentials shows error', async ({ page }) => {
  await page.goto('/sign-in')
  await signIn(page, 'wrong@example.com', 'badpassword')
  await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible()
})

test('protected route redirects unauthenticated user', async ({ page }) => {
  await page.goto('/campaigns')
  await expect(page).toHaveURL(/\/sign-in/)
})
