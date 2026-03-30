import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign } from './helpers/campaign-helpers'
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
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await createNote(page, noteName)
    await openContextMenu(page, noteName)
    await page.getByText(/move to trash|delete/i).click()
    await expect(page.getByText(noteName)).not.toBeVisible()
  })

  test('trash view shows deleted item', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await page.getByRole('button', { name: /^trash/i }).click()
    await expect(page.getByText(noteName)).toBeVisible()
  })

  test('restore item from trash', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await page.getByRole('button', { name: /^trash/i }).click()
    await expect(page.getByText(noteName)).toBeVisible({ timeout: 5000 })
    const trashItem = page
      .locator('.group')
      .filter({ hasText: noteName })
      .first()
    await trashItem.hover()
    const restoreBtn = trashItem.getByRole('button', { name: /restore/i })
    await restoreBtn.click()
    await expect(
      page.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible({ timeout: 10000 })
  })
})
