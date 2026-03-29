import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { getEditor } from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Realtime')
const noteName = `Collab Note ${Date.now()}`

test.describe.serial('realtime collaboration', () => {
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

  test('two tabs see same note content', async ({ browser }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Both navigate to the same note
    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaignName)
    await openItem(page1, noteName)

    await page2.goto('/campaigns')
    await navigateToCampaign(page2, campaignName)
    await openItem(page2, noteName)

    // Type in tab 1
    const editor1 = await getEditor(page1)
    await editor1.click()
    await page1.keyboard.press('Enter')
    const uniqueText = `Sync test ${Date.now()}`
    await page1.keyboard.type(uniqueText)

    // Wait for sync and verify in tab 2
    const editor2 = await getEditor(page2)
    await expect(editor2).toContainText(uniqueText, { timeout: 15000 })

    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  })

  test('item renamed in one tab reflects in another', async ({ browser }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaignName)

    await page2.goto('/campaigns')
    await navigateToCampaign(page2, campaignName)

    // Tab 2 should see the note in sidebar
    const sidebar2 = page2.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar2.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible({ timeout: 10000 })

    // Rename in tab 1
    await openItem(page1, noteName)
    const nameInput = page1.getByRole('textbox', { name: 'Item name' })
    await expect(nameInput).toBeVisible({ timeout: 5000 })
    const newName = `Renamed ${Date.now()}`
    await nameInput.click()
    await nameInput.fill(newName)
    await nameInput.press('Enter')

    // Tab 2 should see the renamed item
    await expect(
      sidebar2.getByRole('link', { name: newName, exact: true }),
    ).toBeVisible({ timeout: 15000 })

    // Rename back for cleanup
    await nameInput.click()
    await nameInput.fill(noteName)
    await nameInput.press('Enter')

    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  })

  test('item deleted in one tab handled in another', async ({ browser }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Create a disposable note
    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaignName)
    const disposableNote = `Disposable ${Date.now()}`
    await createNote(page1, disposableNote)

    // Tab 2 opens the note
    await page2.goto('/campaigns')
    await navigateToCampaign(page2, campaignName)
    await openItem(page2, disposableNote)
    await expect(page2.locator('[contenteditable="true"]').first()).toBeVisible(
      { timeout: 10000 },
    )

    // Tab 1 deletes the note via context menu
    const sidebar1 = page1.getByRole('navigation', { name: 'Sidebar' })
    await sidebar1
      .getByRole('link', { name: disposableNote, exact: true })
      .click({ button: 'right' })
    await page1.getByRole('menuitem', { name: /delete|trash/i }).click()

    // Tab 2 should no longer show the note in sidebar
    const sidebar2 = page2.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar2.getByRole('link', { name: disposableNote, exact: true }),
    ).not.toBeVisible({ timeout: 15000 })

    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  })
})
