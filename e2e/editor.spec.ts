import { expect, test } from '@playwright/test'
import { deleteCampaign } from './helpers/campaign-helpers'
import { createNote as createNoteHelper } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Editor')
const noteName = `Test Note ${Date.now()}`

test.describe.serial('editor workspace', () => {
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

  test('open campaign shows sidebar', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(page.locator('[data-testid="sidebar"], nav')).toBeVisible()
  })

  test('create note appears in sidebar', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await createNoteHelper(page, noteName)
    await expect(
      page
        .locator('[data-testid="sidebar"], nav')
        .getByText(noteName, { exact: true }),
    ).toBeVisible()
  })

  test('click note loads editor', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await page.getByText(noteName).click()
    await expect(
      page.locator('[contenteditable], [data-testid="editor"]'),
    ).toBeVisible()
  })
})
