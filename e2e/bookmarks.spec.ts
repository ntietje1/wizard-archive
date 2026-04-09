import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Bookmarks')
const bookmarkedNote = `Bookmarked ${Date.now()}`
const regularNote = `Regular ${Date.now()}`

test.describe.serial('bookmarks', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, bookmarkedNote)
    await createNote(page, regularNote)
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

  test('bookmark note and filter by bookmarks', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await openContextMenu(page, bookmarkedNote)
    await page.getByRole('menuitem', { name: /bookmark/i }).click()

    await page.getByRole('button', { name: 'Show bookmarks' }).click()

    await expect(sidebar.getByRole('link', { name: bookmarkedNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(sidebar.getByRole('link', { name: regularNote, exact: true })).not.toBeVisible()
  })

  test('exit bookmarks filter shows all notes', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    // Enter bookmarks mode
    await page.getByRole('button', { name: 'Show bookmarks' }).click()
    await expect(sidebar.getByRole('link', { name: regularNote, exact: true })).not.toBeVisible()

    // Exit bookmarks mode
    await page.getByRole('button', { name: 'Exit bookmarks' }).click()

    await expect(sidebar.getByRole('link', { name: bookmarkedNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(sidebar.getByRole('link', { name: regularNote, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })
})
