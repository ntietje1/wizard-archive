import { expect, test } from '@playwright/test'
import { deleteCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const testCampaignName = testName('E2E Campaign')

test.describe.serial('campaign operations', () => {
  test('view campaign list', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('create campaign', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByRole('button', { name: /new campaign|create/i }).click()
    await page.getByLabel('Name').fill(testCampaignName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(testCampaignName)).toBeVisible()
  })

  test('navigate to campaign editor', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(testCampaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(page.locator('[data-testid="sidebar"], nav')).toBeVisible()
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
