import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const testCampaignName = testName('E2E Campaign')

test.describe.serial('campaign operations', () => {
  test('view campaign list', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('create campaign', async ({ page }) => {
    await page.goto('/campaigns')
    await createCampaign(page, testCampaignName)
    await expect(page.getByText(testCampaignName)).toBeVisible()
  })

  test('navigate to campaign editor', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, testCampaignName)
    await expect(
      page.getByRole('navigation', { name: 'Sidebar' }),
    ).toBeVisible()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, testCampaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })
})
