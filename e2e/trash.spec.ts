import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Trash')
const noteName = `TrashNote ${Date.now()}`

test.describe.serial('trash operations', () => {
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

  test('delete item moves it to trash', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('link', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, noteName)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()

    await expect(sidebar.getByRole('link', { name: noteName, exact: true })).not.toBeVisible({
      timeout: 10000,
    })
  })

  test('trash view shows deleted item', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await page.getByRole('button', { name: /^trash/i }).click()
    const trashItem = page.getByTestId(`trash-item-${noteName}`)
    await expect(trashItem).toBeVisible({ timeout: 10000 })
  })

  test('restore item from trash', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await page.getByRole('button', { name: /^trash/i }).click()

    const trashItem = page.getByTestId(`trash-item-${noteName}`)
    await expect(trashItem).toBeVisible({ timeout: 10000 })
    await trashItem.hover()
    const restoreBtn = trashItem.getByRole('button', { name: /restore/i })
    await restoreBtn.click()

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('link', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })
})
