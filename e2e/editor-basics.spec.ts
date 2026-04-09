import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E EdBasics')
let noteName: string
let secondNoteName: string

test.describe.serial('editor basics', () => {
  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    noteName = `Editor Note ${id}`
    secondNoteName = `Nav Note ${id}`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
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

  test('type text into editor', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.type('Hello from Playwright')
    await expect(editor).toContainText('Hello from Playwright')
  })

  test('slash menu creates heading', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')

    const menu = page.getByRole('listbox')
    await expect(menu).toBeVisible({ timeout: 5000 })

    await page.getByRole('option', { name: /^Heading 1/ }).click()
    await page.keyboard.type('My Heading')

    await expect(editor).toContainText('My Heading')
  })

  test('bold text with Ctrl+B', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.press('Enter')

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${mod}+b`)
    await page.keyboard.type('bold text here')
    await page.keyboard.press(`${mod}+b`)

    await expect(page.locator('[contenteditable="true"] strong')).toBeVisible({
      timeout: 5000,
    })
  })

  test('content persists after navigation', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Type unique content and wait for save
    const persistText = `Persist ${Date.now()}`
    await editor.click()
    await page.keyboard.press('Enter')
    await page.keyboard.type(persistText)
    await expect(editor).toContainText(persistText)

    // Navigate away and wait for second note's editor to load
    await openItem(page, secondNoteName)
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({
      timeout: 10000,
    })

    // Navigate back and verify content persisted
    await openItem(page, noteName)
    await expect(editor).toContainText(persistText, {
      timeout: 10000,
    })
  })
})
