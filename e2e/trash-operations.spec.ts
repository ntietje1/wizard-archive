import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Trash Ops')
let note1: string
let note2: string
let note3: string

test.describe.serial('trash: empty & permanent delete', () => {
  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    note1 = `Note1 ${id}-1`
    note2 = `Note2 ${id}-2`
    note3 = `Note3 ${id}-3`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, note1)
    await createNote(page, note2)
    await createNote(page, note3)
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

  test('move note to trash via context menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('link', { name: note1, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, note1)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()

    await expect(sidebar.getByRole('link', { name: note1, exact: true })).not.toBeVisible({
      timeout: 10000,
    })
  })

  test('permanently delete one item from trash', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // Open trash popover
    await page.getByRole('button', { name: /^trash/i }).click()
    await expect(page.getByText(note1)).toBeVisible({ timeout: 5000 })

    // Hover over the note text to reveal action buttons, then click delete
    await page.getByText(note1).hover()
    await page.getByRole('button', { name: 'Delete forever' }).click()

    // Confirm permanent deletion
    const confirmDialog = page.getByRole('dialog', {
      name: /permanently delete/i,
    })
    await confirmDialog.getByRole('button', { name: /delete forever/i }).click()

    await expect(confirmDialog).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText(note1)).not.toBeVisible({ timeout: 5000 })
  })

  test('empty trash removes all trashed items', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // Move remaining notes to trash
    await openContextMenu(page, note2)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()
    await expect(page.getByRole('link', { name: note2, exact: true })).not.toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, note3)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()
    await expect(page.getByRole('link', { name: note3, exact: true })).not.toBeVisible({
      timeout: 10000,
    })

    // Open trash popover and empty
    await page.getByRole('button', { name: /^trash/i }).click()
    await expect(page.getByText(note2)).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /empty trash/i }).click()

    // Confirm
    const dialog = page.getByRole('dialog', { name: /empty trash/i })
    await dialog.getByRole('button', { name: /empty trash/i }).click()

    await expect(page.getByText(/trash is empty/i)).toBeVisible({
      timeout: 10000,
    })
  })
})
