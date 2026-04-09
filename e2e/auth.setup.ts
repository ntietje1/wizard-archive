import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { test as setup } from '@playwright/test'
import { signIn } from './helpers/auth-helpers'

const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  await page.goto('/sign-in', { waitUntil: 'networkidle' })
  await signIn(page, email, password)
  await page.waitForURL('**/campaigns', { timeout: 15000 })
  await mkdir(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
