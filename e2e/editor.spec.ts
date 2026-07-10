import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign } from './helpers/campaign-helpers'
import { createNote as createNoteHelper } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Workspace')
const noteName = `Test Note ${Date.now()}`

test.describe.serial('workspace', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('open campaign shows sidebar', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()
  })

  test('create note appears in sidebar', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await createNoteHelper(page, noteName)
    await expect(page.getByRole('button', { name: noteName, exact: true })).toBeVisible()
  })

  test('click note loads editor', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    const localNote = `Editor Note ${Date.now()}`
    await createNoteHelper(page, localNote)
    await page.getByRole('button', { name: localNote, exact: true }).click()
    await expect(page.locator('[contenteditable], [data-testid="editor"]')).toBeVisible()
  })
})
