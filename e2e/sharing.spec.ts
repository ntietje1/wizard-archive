import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Sharing')
const noteName = `Shared Note ${Date.now()}`

test.describe.serial('sharing', () => {
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    await page.close()
    await context.close()
  })

  test('open share menu from topbar', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await page.getByText(noteName).click()

    await page.getByRole('button', { name: /share/i }).click()
    await expect(
      page.getByText(/share|permissions|access/i).first(),
    ).toBeVisible()
  })

  test('set all-players permission level', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await page.getByText(noteName).click()

    await page.getByRole('button', { name: /share/i }).click()

    const noneSelect = page.getByText('None').first()
    await expect(noneSelect).toBeVisible()
    await noneSelect.click()
    await page.getByRole('option', { name: /view/i }).first().click()
  })

  test('view-as-player dropdown opens', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const viewAsButton = page.getByRole('button', { name: /view as/i })
    await expect(viewAsButton).toBeVisible()
    await viewAsButton.click()
    await expect(
      page.getByText(/no other players in this campaign/i),
    ).toBeVisible()
  })
})
