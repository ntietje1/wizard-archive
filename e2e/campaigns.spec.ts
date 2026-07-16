import { expect, test } from '@playwright/test'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { createCampaign, deleteCampaignById, navigateToCampaign } from './helpers/campaign-helpers'
import { testName } from './helpers/constants'

const testCampaignName = testName('E2E Campaign')
let campaignId: CampaignId

test.describe.serial('campaign operations', () => {
  test('view campaign list', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('create campaign', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    campaignId = await createCampaign(page, testCampaignName)
    await expect(page.getByText(testCampaignName)).toBeVisible()
  })

  test('navigate to campaign editor', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, testCampaignName)
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()
  })

  test.afterAll(async () => {
    if (campaignId) await deleteCampaignById(campaignId)
  })
})
