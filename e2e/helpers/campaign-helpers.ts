import { expect } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { signInByApi } from './auth-helpers'
import { createE2EConvexClient } from './convex-helpers'
import type { Locator, Page } from '@playwright/test'

export async function createCampaign(page: Page, name: string) {
  const newCampaignButton = await waitForCampaignsDashboard(page)
  await newCampaignButton.click()

  const dialog = page.getByRole('dialog', { name: /new campaign/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  const nameInput = dialog.getByLabel(/campaign name/i)
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  const slugInput = dialog.getByLabel(/custom link/i)
  await expect(slugInput).toBeVisible({ timeout: 5000 })
  const slug = slugForCampaignName(name)
  const createBtn = dialog.getByRole('button', { name: /^create campaign$/i })
  let lastError: unknown

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fillCampaignNameInput(nameInput, name)
      await fillCampaignSlugInput(slugInput, slug)
      await nameInput.blur()
      await slugInput.blur()

      await expect(nameInput).toHaveValue(name, { timeout: 5000 })
      await expect(slugInput).toHaveValue(slug, { timeout: 5000 })
      await expect(createBtn).toBeEnabled({ timeout: 15000 })
      await createBtn.click({ timeout: 5000 })
      await expect(dialog).not.toBeVisible({ timeout: 30000 })
      await expect(page.getByRole('article', { name })).toBeVisible({ timeout: 15000 })
      return
    } catch (error) {
      lastError = error
      if (!(await dialog.isVisible().catch(() => false))) {
        throw error
      }
      await page.waitForTimeout(250 * (attempt + 1))
    }
  }

  throw lastError
}

async function fillCampaignNameInput(nameInput: Locator, name: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await expect(nameInput).toBeEditable({ timeout: 5000 })
    await nameInput.fill(name)
    if ((await nameInput.inputValue({ timeout: 1000 }).catch(() => null)) === name) {
      return
    }
  }

  await expect(nameInput).toHaveValue(name, { timeout: 5000 })
}

async function fillCampaignSlugInput(slugInput: Locator, slug: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await expect(slugInput).toBeEditable({ timeout: 5000 })
    await slugInput.fill(slug)
    if ((await slugInput.inputValue({ timeout: 1000 }).catch(() => null)) === slug) {
      return
    }
  }

  await expect(slugInput).toHaveValue(slug, { timeout: 5000 })
}

function slugForCampaignName(name: string) {
  let hash = 0
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }

  return `e2e-${hash.toString(36).padStart(7, '0')}`.slice(0, 30)
}

export async function navigateToCampaign(page: Page, campaignName: string) {
  await waitForCampaignsDashboard(page)
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\/[^/]+\/editor/)
  const resources = page.getByRole('navigation', { name: 'Sidebar' })
  const campaignNotFound = page.getByRole('heading', { name: 'Campaign Not Found' })
  await expect(resources.or(campaignNotFound)).toBeVisible({ timeout: 30000 })
  if (await campaignNotFound.isVisible()) {
    throw new Error(`Campaign card navigated to an unavailable campaign: ${page.url()}`)
  }
}

export async function deleteCampaign(page: Page, name: string) {
  await waitForCampaignsDashboard(page)

  const card = page.getByRole('article', { name })
  if (!(await card.isVisible({ timeout: 15000 }).catch(() => false))) {
    await deleteCampaignByApi(name)
    return
  }

  await card.getByRole('button', { name: /delete campaign/i }).click()
  const dialog = page.getByRole('dialog', { name: /delete campaign/i })
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /^delete/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
}

async function deleteCampaignByApi(name: string) {
  const client = await createE2EConvexClient()
  const campaigns = await client.query(api.campaigns.queries.getUserCampaigns, {})
  const campaign = campaigns.find((candidate) => candidate.name === name)
  if (!campaign) return

  await client.mutation(api.campaigns.mutations.deleteCampaign, {
    campaignId: campaign.id,
  })
}

async function waitForCampaignsDashboard(page: Page) {
  const newCampaignButton = page
    .getByRole('button', {
      name: /new campaign|create.*campaign|first campaign/i,
    })
    .first()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await newCampaignButton.isVisible({ timeout: 30000 }).catch(() => false)) {
      return newCampaignButton
    }

    const isSignInPage = await page
      .getByRole('button', { name: /^sign in$/i })
      .isVisible()
      .catch(() => false)
    const isAuthLoading = await page
      .getByRole('button', { name: /user menu loading/i })
      .isVisible()
      .catch(() => false)

    if (!isSignInPage && !isAuthLoading) {
      break
    }

    await refreshAuthStorageState(page)
    await page.goto('/campaigns', { waitUntil: 'commit' })
  }

  await expect(newCampaignButton).toBeVisible({ timeout: 30000 })
  return newCampaignButton
}

async function refreshAuthStorageState(page: Page) {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  await signInByApi(page, email, password)
}
