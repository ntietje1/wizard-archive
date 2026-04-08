import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  clickHistoryEntry,
  exitPreview,
  openHistoryPanel,
  restoreFromPreview,
  waitForHistoryEntry,
} from './helpers/history-helpers'

const campaignName = testName('E2E EditHistory')
const noteName = `History Note ${Date.now()}`
const initialContent = 'Hello history test'
const updatedContent = ' — updated content'

test.describe.serial('edit history', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.type(initialContent)
    await expect(editor).toContainText(initialContent)

    await openHistoryPanel(page)
    await waitForHistoryEntry(page, /edited content/i)
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

  test('history panel shows creation entry', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await waitForHistoryEntry(page, /created/i)
  })

  test('history panel shows edited content entry from setup', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await waitForHistoryEntry(page, /edited content/i)
  })

  test('clicking snapshot entry opens preview mode', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await clickHistoryEntry(page, /edited content/i)

    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible()
  })

  test('exit button closes preview', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await clickHistoryEntry(page, /edited content/i)
    await exitPreview(page)

    await expect(editor).toBeVisible()
  })

  test('restore button opens confirmation dialog', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await clickHistoryEntry(page, /edited content/i)

    await page.getByRole('button', { name: 'Restore' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText('Restore this version?')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Restore' })).toBeVisible()
  })

  test('cancel closes dialog without restoring', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await clickHistoryEntry(page, /edited content/i)

    await page.getByRole('button', { name: 'Restore' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    await expect(page.getByText(/previewing version from/i)).toBeVisible()

    await exitPreview(page)
  })

  test('restoring a version succeeds', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(updatedContent)
    await expect(editor).toContainText(updatedContent)

    await openHistoryPanel(page)
    await clickHistoryEntry(page, /edited content/i)
    await restoreFromPreview(page)

    await expect(page.getByText(/previewing version from/i)).not.toBeVisible({
      timeout: 5000,
    })
  })

  test('rollback creates new history entry', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    await openHistoryPanel(page)
    await waitForHistoryEntry(page, /restored a previous version/i)
  })
})
