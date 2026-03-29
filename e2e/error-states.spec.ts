import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Errors')
const note1 = `ErrNote1 ${Date.now()}`
const note2 = `ErrNote2 ${Date.now()}`

test.describe.serial('error states', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, note1)
    await createNote(page, note2)
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

  test('rename to duplicate name shows error', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await expect(
      page.getByRole('link', { name: note1, exact: true }),
    ).toBeVisible({ timeout: 10000 })

    await openContextMenu(page, note1)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = page.getByPlaceholder(/enter a name/i)
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill(note2)
    await renameInput.press('Enter')

    // Expect either an error toast or aria-invalid on the input
    const errorToast = page.locator('[data-sonner-toast]').filter({
      hasText: /already|duplicate|taken|exists/i,
    })
    const invalidInput = page.locator('input[aria-invalid="true"]')

    await expect(errorToast.or(invalidInput)).toBeVisible({ timeout: 5000 })
  })

  test('campaign slug validation shows error for empty slug', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await page.waitForLoadState('networkidle')

    await page
      .getByRole('button', { name: /new campaign|create.*campaign/i })
      .first()
      .click()

    await page.getByLabel(/campaign name/i).fill('Test Campaign')

    const slugInput = page.getByLabel(/custom link/i)
    await slugInput.clear()
    await slugInput.blur()

    await expect(page.getByText('Campaign link is required')).toBeVisible({
      timeout: 5000,
    })

    await page.keyboard.press('Escape')
    await expect(page.getByLabel(/campaign name/i)).not.toBeVisible()
  })
})
