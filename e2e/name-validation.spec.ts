import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E NameVal')
const existingNoteName = `Existing Note ${Date.now()}`
const secondNoteName = `Second Note ${Date.now()}`

function sidebarRenameInput(page: Page) {
  return page
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('textbox', { name: 'Item name', exact: true })
}

test.describe.serial('name validation', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
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
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('duplicate name shows validation error', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('button', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = sidebarRenameInput(page)
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill(existingNoteName)

    await expect(renameInput).toHaveAttribute('aria-invalid', 'true', {
      timeout: 5000,
    })
  })

  test('empty name is rejected', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('button', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = sidebarRenameInput(page)
    await expect(renameInput).toBeVisible({ timeout: 5000 })
    await renameInput.fill('')
    await renameInput.blur()

    await expect(page.getByRole('button', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })

  test('special characters in name', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('button', { name: secondNoteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, secondNoteName)
    await page.getByRole('menuitem', { name: /rename/i }).click()

    const renameInput = sidebarRenameInput(page)
    await expect(renameInput).toBeVisible({ timeout: 5000 })

    const specialName = `Special & ${Date.now()}`
    await renameInput.fill(specialName)
    await renameInput.press('Enter')

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const renamed = sidebar.getByRole('button', {
      name: specialName,
      exact: true,
    })
    await expect(renamed).toBeVisible({ timeout: 10000 })
  })
})
