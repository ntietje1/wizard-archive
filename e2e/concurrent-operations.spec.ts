import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Concurrent')

test.describe.serial('concurrent operations', () => {
  test.beforeAll(async ({ browser }) => {
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
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('note created in one tab appears in another via real-time sync', async ({
    browser,
  }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await page1.goto('/campaigns')
    await page2.goto('/campaigns')
    await navigateToCampaign(page1, campaignName)
    await navigateToCampaign(page2, campaignName)

    const noteName = `SyncNote ${Date.now()}`
    await createNote(page1, noteName)

    const sidebar2 = page2.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar2.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible({ timeout: 15000 })

    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  })
})
