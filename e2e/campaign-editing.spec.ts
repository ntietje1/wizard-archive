import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CampEdit')
let updatedName: string
let updatedDescription: string

test.describe.serial('campaign editing', () => {
  test.beforeAll(async ({ browser }) => {
    const ts = Date.now()
    updatedName = `Updated ${ts}`
    updatedDescription = `Description updated at ${ts}`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, updatedName)
    } catch {
      /* best-effort */
    }
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('edit campaign name and description', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByText(campaignName)).toBeVisible({ timeout: 10000 })

    const card = page.getByRole('article', { name: campaignName })
    await card.getByRole('button', { name: /edit campaign/i }).click()

    await expect(page.getByRole('heading', { name: /edit campaign/i })).toBeVisible({
      timeout: 10000,
    })

    const nameField = page.getByLabel(/campaign name/i)
    await nameField.fill(updatedName)

    const descField = page.getByLabel(/description/i)
    await descField.fill(updatedDescription)

    await page.getByRole('button', { name: /update campaign/i }).click()

    await expect(page.getByRole('heading', { name: /edit campaign/i })).not.toBeVisible({
      timeout: 10000,
    })

    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })
  })

  test('updated name persists after reload', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })
  })
})
