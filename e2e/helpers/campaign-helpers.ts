import { expect } from '@playwright/test'
import { api } from 'convex/_generated/api'
import { signInByApi } from './auth-helpers'
import { createE2EConvexClient } from './convex-helpers'
import type { Locator, Page } from '@playwright/test'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

export async function createCampaign(page: Page, name: string): Promise<CampaignId> {
  const newCampaignButton = await waitForCampaignsDashboard(page)
  await newCampaignButton.click()

  const dialog = page.getByRole('dialog', { name: /new campaign/i })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  const nameInput = dialog.getByLabel(/campaign name/i)
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  const createBtn = dialog.getByRole('button', { name: /^create campaign$/i })
  let lastError: unknown

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fillCampaignNameInput(nameInput, name)
      await nameInput.blur()

      await expect(nameInput).toHaveValue(name, { timeout: 5000 })
      await expect(createBtn).toBeEnabled({ timeout: 15000 })
      await createBtn.click({ timeout: 5000 })
      await expect(dialog).not.toBeVisible({ timeout: 30000 })
      const card = page.getByRole('article', { name })
      await expect(card).toBeVisible({ timeout: 15000 })
      const href = await card.getByRole('link').getAttribute('href')
      const campaignId = href?.match(/^\/campaigns\/([^/]+)\/editor$/)?.[1]
      if (!campaignId) throw new Error(`Created campaign card has no canonical route: ${href}`)
      return assertDomainId(DOMAIN_ID_KIND.campaign, decodeURIComponent(campaignId))
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

export async function navigateToCampaign(page: Page, campaignName: string) {
  await waitForCampaignsDashboard(page)
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\/[^/]+\/editor/)
  await waitForWorkspaceReady(page, `Campaign card navigated to an unavailable campaign`)
}

export async function provisionCampaign(name: string): Promise<CampaignId> {
  const client = await createE2EConvexClient()
  return await client.mutation(api.campaigns.mutations.createCampaign, { name })
}

export async function navigateToCampaignId(page: Page, campaignId: CampaignId) {
  await navigateToCampaignRoute(page, campaignId)
}

export async function navigateToCampaignResource(
  page: Page,
  campaignId: CampaignId,
  resourceId: ResourceId,
) {
  await navigateToCampaignRoute(page, campaignId, resourceId)
}

async function navigateToCampaignRoute(
  page: Page,
  campaignId: CampaignId,
  resourceId?: ResourceId,
) {
  await authenticatePage(page)
  const search = resourceId ? `?resource=${resourceId}` : ''
  await page.goto(`/campaigns/${campaignId}/editor${search}`, { waitUntil: 'commit' })
  await waitForWorkspaceReady(page, `Provisioned campaign is unavailable: ${campaignId}`)
}

async function waitForWorkspaceReady(page: Page, missingMessage: string) {
  const workspace = page.getByRole('region', { name: 'Editor workspace' })
  const campaignNotFound = page.getByRole('heading', { name: 'Campaign Not Found' })
  await expect(workspace.or(campaignNotFound)).toBeVisible({ timeout: 30_000 })
  if (await campaignNotFound.isVisible()) {
    throw new Error(`${missingMessage}: ${page.url()}`)
  }
  await expect(workspace).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
  const failure = workspace.getByRole('alert')
  if (await failure.isVisible().catch(() => false)) {
    throw new Error((await failure.textContent()) ?? 'Workspace failed to load')
  }
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()
}

export async function deleteCampaignById(campaignId: CampaignId) {
  const client = await createE2EConvexClient()
  await client.mutation(api.campaigns.mutations.deleteCampaign, { campaignId })
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

    await authenticatePage(page)
    await page.goto('/campaigns', { waitUntil: 'commit' })
  }

  await expect(newCampaignButton).toBeVisible({ timeout: 30000 })
  return newCampaignButton
}

async function authenticatePage(page: Page) {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set')
  }

  await signInByApi(page, email, password)
}
