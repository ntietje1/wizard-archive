import { expect, test } from '@playwright/test'
import { deleteCampaign } from './helpers/campaign-helpers'
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
    await page.getByRole('button', { name: /new campaign|create/i }).click()
    await page.getByLabel('Name').fill(campaignName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(campaignName)).toBeVisible()
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
    await page.getByRole('button', { name: /trash/i }).click()
    await expect(page.getByText(noteName)).toBeVisible()
  })

  test('restore item from trash', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await page.getByRole('button', { name: /trash/i }).click()
    await page.getByText(noteName).click({ button: 'right' })
    await page.getByText(/restore/i).click()
    await expect(page.getByText(noteName)).not.toBeVisible()

    await page.getByRole('button', { name: /trash/i }).click()
    await expect(page.getByText(noteName)).toBeVisible()
  })
})
