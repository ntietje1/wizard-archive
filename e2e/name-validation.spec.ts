import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E NameVal')
const existingNoteName = `Existing Note ${Date.now()}`
const secondNoteName = `Second Note ${Date.now()}`

test.describe.serial('name validation', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, existingNoteName)
    await createNote(page, secondNoteName)
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

  test('duplicate name shows validation error', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = page.getByRole('textbox', { name: /enter a name/i })
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill(existingNoteName)

    await expect(renameInput).toHaveAttribute('aria-invalid', 'true', {
      timeout: 5000,
    })
  })

  test('empty name is rejected', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = page.getByRole('textbox', { name: /enter a name/i })
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill('')
    await renameInput.blur()

    await expect(page.getByRole('link', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })

  test('special characters in name', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = page.getByRole('textbox', { name: /enter a name/i })
    await expect(renameInput).toBeVisible({ timeout: 5000 })

    const specialName = `Special & ${Date.now()}`
    await renameInput.fill(specialName)
    await renameInput.press('Enter')

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const renamed = sidebar.getByRole('link', {
      name: specialName,
      exact: true,
    })
    await expect(renamed).toBeVisible({ timeout: 10000 })
  })
})
