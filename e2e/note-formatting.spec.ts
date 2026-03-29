import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import {
  getEditor,
  newParagraphAtEnd,
  selectSlashMenuItem,
} from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Formatting')
const noteName = `Format Note ${Date.now()}`

test.describe.serial('note formatting', () => {
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

  test('italic text with Ctrl+I', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.press('Enter')

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${mod}+i`)
    await page.keyboard.type('italic text here')
    await page.keyboard.press(`${mod}+i`)

    await expect(page.locator('[contenteditable="true"] em')).toBeVisible({
      timeout: 5000,
    })
  })

  test('underline text with Ctrl+U', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.press('Enter')

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${mod}+u`)
    await page.keyboard.type('underline text here')
    await page.keyboard.press(`${mod}+u`)

    await expect(
      page.locator(
        '[contenteditable="true"] [style*="underline"], [contenteditable="true"] u',
      ),
    ).toBeVisible({ timeout: 5000 })
  })

  test('strikethrough text', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.press('Enter')

    const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${mod}+Shift+s`)
    await page.keyboard.type('strikethrough text')
    await page.keyboard.press(`${mod}+Shift+s`)

    await expect(
      page.locator(
        '[contenteditable="true"] s, [contenteditable="true"] del, [contenteditable="true"] [style*="line-through"]',
      ),
    ).toBeVisible({ timeout: 5000 })
  })

  test('bullet list via slash menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    await newParagraphAtEnd(page)

    await selectSlashMenuItem(page, /bullet/i)
    await page.keyboard.type('First bullet item')

    const editor = await getEditor(page)
    await expect(
      editor.locator('li, [data-content-type="bulletListItem"]'),
    ).toBeVisible({ timeout: 5000 })
  })

  test('numbered list via slash menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    await newParagraphAtEnd(page)

    await selectSlashMenuItem(page, /numbered/i)
    await page.keyboard.type('First numbered item')

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(
      editor.locator('ol, [data-content-type="numberedListItem"]'),
    ).toBeVisible({
      timeout: 5000,
    })
  })

  test('quote block via slash menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    await newParagraphAtEnd(page)

    await selectSlashMenuItem(page, /quote/i)
    await page.keyboard.type('A wise quote')

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(
      editor.locator('[data-content-type="quote"]').first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('code block via slash menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    await newParagraphAtEnd(page)

    await selectSlashMenuItem(page, /code/i)
    await page.keyboard.type('const x = 42')

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(
      editor.locator('[data-content-type="codeBlock"]').first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('table via slash menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    await newParagraphAtEnd(page)

    await selectSlashMenuItem(page, /table/i)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(
      editor.locator('[data-content-type="table"]').first(),
    ).toBeVisible({ timeout: 5000 })
  })
})
