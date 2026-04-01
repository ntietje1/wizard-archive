import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { getEditor } from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser, Locator, Page } from '@playwright/test'

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'
const campaignName = testName('E2E EdStress')

async function setupCampaignWithNotes(
  browser: Browser,
  noteNames: Array<string>,
) {
  const ctx = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
  const page = await ctx.newPage()
  await page.goto('/campaigns')
  await createCampaign(page, campaignName)
  await navigateToCampaign(page, campaignName)
  for (const name of noteNames) {
    await createNote(page, name)
  }
  await page.close()
  await ctx.close()
}

async function navigateToNote(page: Page, noteName: string) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openItem(page, noteName)
  return await getEditor(page)
}

async function selectSlashItem(page: Page, itemName: string | RegExp) {
  await page.keyboard.type('/')
  const menu = page.getByRole('listbox')
  await expect(menu).toBeVisible({ timeout: 5000 })
  await page.getByRole('option', { name: itemName }).click()
}

async function withDualEditors(
  browser: Browser,
  noteName: string,
  testFn: (ctx: {
    page1: Page
    page2: Page
    editor1: Locator
    editor2: Locator
  }) => Promise<void>,
) {
  const context1 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const context2 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  const page1 = await context1.newPage()
  const page2 = await context2.newPage()

  try {
    await page1.goto('/campaigns')
    await navigateToCampaign(page1, campaignName)
    await openItem(page1, noteName)

    await page2.goto('/campaigns')
    await navigateToCampaign(page2, campaignName)
    await openItem(page2, noteName)

    const editor1 = await getEditor(page1)
    const editor2 = await getEditor(page2)

    await testFn({ page1, page2, editor1, editor2 })
  } finally {
    await page1.close()
    await page2.close()
    await context1.close()
    await context2.close()
  }
}

test.describe.serial('editor stress tests', () => {
  const notes = {
    midInsert: `MidInsert ${Date.now()}`,
    nesting: `Nesting ${Date.now()}`,
    reload: `Reload ${Date.now()}`,
    selectAll: `SelectAll ${Date.now()}`,
    slashFilter: `SlashFilter ${Date.now()}`,
    sequence: `Sequence ${Date.now()}`,
    formatSync: `FormatSync ${Date.now()}`,
    collabFormat: `CollabFmt ${Date.now()}`,
    multiParagraph: `MultiPara ${Date.now()}`,
    undoBasic: `UndoBasic ${Date.now()}`,
    undoSelect: `UndoSel ${Date.now()}`,
    redoAfterSync: `RedoSync ${Date.now()}`,
    complex: `Complex ${Date.now()}`,
  }

  test.beforeAll(async ({ browser }) => {
    await setupCampaignWithNotes(browser, Object.values(notes))
  })

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await ctx.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch (err) {
      console.warn(
        `[cleanup] Failed to delete campaign "${campaignName}":`,
        err,
      )
    }
    await page.close()
    await ctx.close()
  })

  test('undo reverses typed text', async ({ page }) => {
    const editor = await navigateToNote(page, notes.undoBasic)
    await editor.click()

    const text = `UndoMe-${Date.now()}`
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await page.keyboard.press(`${MOD}+z`)
    await page.keyboard.press(`${MOD}+z`)
    await page.keyboard.press(`${MOD}+z`)

    await expect(editor).not.toContainText(text, { timeout: 5000 })
  })

  test('redo restores undone text', async ({ page }) => {
    const editor = await navigateToNote(page, notes.undoSelect)
    await editor.click()

    const text = `Redo-${Date.now()}`
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await page.keyboard.press(`${MOD}+z`)
    await page.keyboard.press(`${MOD}+z`)
    await page.keyboard.press(`${MOD}+z`)
    await expect(editor).not.toContainText(text, { timeout: 5000 })

    await page.keyboard.press(`${MOD}+Shift+z`)
    await expect(editor).toContainText(text, { timeout: 5000 })
  })

  test('redo works after undo and sync round-trips', async ({ page }) => {
    const editor = await navigateToNote(page, notes.redoAfterSync)
    await editor.click()

    const text = `RedoSync-${Date.now()}`
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    // Wait for Yjs to sync the content to the server and back
    await page.waitForTimeout(3000)

    // Undo all content (back to empty)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press(`${MOD}+z`)
    }
    await expect(editor).not.toContainText(text, { timeout: 5000 })

    // Wait for the empty state to sync back
    await page.waitForTimeout(3000)

    // Redo should restore the text
    await page.keyboard.press(`${MOD}+Shift+z`)
    await expect(editor).toContainText(text, { timeout: 5000 })
  })

  test('typing in middle of existing content does not corrupt surrounding text', async ({
    page,
  }) => {
    const editor = await navigateToNote(page, notes.midInsert)
    await editor.click()

    const before = `Before-${Date.now()}`
    const after = `After-${Date.now()}`
    await page.keyboard.type(before + after)

    await expect(editor).toContainText(before + after)

    for (let i = 0; i < after.length; i++) {
      await page.keyboard.press('ArrowLeft')
    }

    const middle = `-INSERTED-`
    await page.keyboard.type(middle)

    await expect(editor).toContainText(before + middle + after)
  })

  test('nested list indentation with Tab and Shift+Tab', async ({ page }) => {
    const editor = await navigateToNote(page, notes.nesting)
    await editor.click()

    await selectSlashItem(page, /bullet/i)

    const top = `Top-${Date.now()}`
    const nested = `Nested-${Date.now()}`
    const deepNested = `Deep-${Date.now()}`

    await page.keyboard.type(top)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.keyboard.type(nested)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    await page.keyboard.type(deepNested)

    await expect(editor).toContainText(top)
    await expect(editor).toContainText(nested)
    await expect(editor).toContainText(deepNested)

    const nestedGroup = editor.locator(
      '.bn-block-group .bn-block-group [data-content-type="bulletListItem"]',
    )
    await expect(nestedGroup.first()).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')

    await expect(editor).toContainText(deepNested)
  })

  test('content persists through hard reload', async ({ page }) => {
    const editor = await navigateToNote(page, notes.reload)
    await editor.click()

    const text = `Persist-Reload-${Date.now()}`
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await page.waitForLoadState('networkidle')

    await page.reload({ waitUntil: 'networkidle' })

    const editorAfter = await getEditor(page)
    await expect(editorAfter).toContainText(text, { timeout: 15000 })
  })

  test('select all and delete clears document and syncs', async ({
    browser,
  }) => {
    await withDualEditors(
      browser,
      notes.selectAll,
      async ({ page1, editor1, editor2 }) => {
        await editor1.click()
        const text = `FillContent-${Date.now()}`
        await page1.keyboard.type(text)
        await page1.keyboard.press('Enter')
        await page1.keyboard.type('More content here')

        await expect(editor2).toContainText(text, { timeout: 15000 })

        await editor1.click()
        await page1.keyboard.press(`${MOD}+a`)
        await page1.waitForFunction(
          () => (window.getSelection()?.toString()?.length ?? 0) > 0,
          { timeout: 3000 },
        )
        await page1.keyboard.press('Backspace')

        await expect(editor1).not.toContainText(text, { timeout: 10000 })
        await expect(editor2).not.toContainText(text, { timeout: 15000 })
      },
    )
  })

  test('slash menu filters items by query', async ({ page }) => {
    const editor = await navigateToNote(page, notes.slashFilter)
    await editor.click()

    await page.keyboard.type('/')
    const menu = page.getByRole('listbox')
    await expect(menu).toBeVisible({ timeout: 5000 })

    const allOptions = menu.getByRole('option')
    const initialCount = await allOptions.count()
    expect(initialCount).toBeGreaterThan(3)

    await page.keyboard.type('head')

    await expect(
      menu.getByRole('option', { name: /heading/i }).first(),
    ).toBeVisible()
    const filteredCount = await allOptions.count()
    expect(filteredCount).toBeLessThan(initialCount)

    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()

    const filterText = 'head'
    for (let i = 0; i < filterText.length + 1; i++)
      await page.keyboard.press('Backspace')

    await page.keyboard.type('/')
    await expect(menu).toBeVisible({ timeout: 5000 })
    await page.keyboard.type('xyznonexistent')

    await expect(menu).not.toBeVisible({ timeout: 3000 })
  })

  test('multiple block types created in sequence', async ({ page }) => {
    const editor = await navigateToNote(page, notes.sequence)
    await editor.click()

    await selectSlashItem(page, /^Heading 1/)
    await page.keyboard.type('Title')
    await page.keyboard.press('Enter')

    await page.keyboard.type('A paragraph of text.')
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /^Heading 2/)
    await page.keyboard.type('Subsection')
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /numbered/i)
    await page.keyboard.type('Step one')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Step two')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /quote/i)
    await page.keyboard.type('A notable quote')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /table/i)

    await expect(editor).toContainText('Title')
    await expect(editor).toContainText('A paragraph of text.')
    await expect(editor).toContainText('Subsection')
    await expect(editor).toContainText('Step one')
    await expect(editor).toContainText('Step two')
    await expect(editor).toContainText('A notable quote')
    await expect(
      editor.locator('[data-content-type="table"]').first(),
    ).toBeVisible()

    const headings = editor.locator('[data-content-type="heading"]')
    await expect(headings).toHaveCount(2)
  })

  test('formatted text syncs correctly between tabs', async ({ browser }) => {
    await withDualEditors(
      browser,
      notes.formatSync,
      async ({ page1, editor1, editor2 }) => {
        await editor1.click()

        await page1.keyboard.press(`${MOD}+b`)
        const boldText = `BoldSync-${Date.now()}`
        await page1.keyboard.type(boldText)
        await page1.keyboard.press(`${MOD}+b`)

        await page1.keyboard.type(' ')

        await page1.keyboard.press(`${MOD}+i`)
        const italicText = `ItalicSync-${Date.now()}`
        await page1.keyboard.type(italicText)
        await page1.keyboard.press(`${MOD}+i`)

        await expect(editor2).toContainText(boldText, { timeout: 15000 })
        await expect(editor2).toContainText(italicText, { timeout: 15000 })

        await expect(
          editor2.locator('strong', { hasText: boldText }),
        ).toBeVisible({ timeout: 5000 })
        await expect(
          editor2.locator('em', { hasText: italicText }),
        ).toBeVisible({ timeout: 5000 })
      },
    )
  })

  test('collaborative editing with formatting does not corrupt document', async ({
    browser,
  }) => {
    await withDualEditors(
      browser,
      notes.collabFormat,
      async ({ page1, page2, editor1, editor2 }) => {
        await editor1.click()
        const baseText = `Base-${Date.now()}`
        await page1.keyboard.type(baseText)
        await page1.keyboard.press('Enter')
        const secondLine = `SecondLine-${Date.now()}`
        await page1.keyboard.type(secondLine)

        await expect(editor2).toContainText(baseText, { timeout: 15000 })
        await expect(editor2).toContainText(secondLine, { timeout: 15000 })

        await editor1.click()
        await page1.keyboard.press('Home')
        await page1.keyboard.press(`${MOD}+Home`)
        await page1.keyboard.press(`${MOD}+Shift+End`)
        await page1.keyboard.press(`${MOD}+b`)

        await editor2.click()
        await page2.keyboard.press(`${MOD}+End`)
        await page2.keyboard.press('Enter')
        const tab2Text = `Tab2Addition-${Date.now()}`
        await page2.keyboard.type(tab2Text)

        await expect(editor1).toContainText(tab2Text, { timeout: 15000 })
        await expect(editor2).toContainText(baseText, { timeout: 15000 })

        await expect(editor1).toContainText(baseText)
        await expect(editor1).toContainText(secondLine)
        await expect(editor1).toContainText(tab2Text)
        await expect(editor2).toContainText(baseText)
        await expect(editor2).toContainText(secondLine)
        await expect(editor2).toContainText(tab2Text)
      },
    )
  })

  test('rapid multi-paragraph typing syncs completely', async ({ browser }) => {
    await withDualEditors(
      browser,
      notes.multiParagraph,
      async ({ page1, editor1, editor2 }) => {
        await editor1.click()

        const paragraphs: Array<string> = []
        for (let i = 0; i < 10; i++) {
          const p = `Para-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          paragraphs.push(p)
          await page1.keyboard.type(p, { delay: 0 })
          await page1.keyboard.press('Enter')
        }

        for (const p of paragraphs) {
          await expect(editor2).toContainText(p, { timeout: 20000 })
        }
      },
    )
  })

  test('complex document with mixed block types persists across navigation', async ({
    page,
  }) => {
    const editor = await navigateToNote(page, notes.complex)
    await editor.click()

    await selectSlashItem(page, /^Heading 1/)
    const heading = `Heading-${Date.now()}`
    await page.keyboard.type(heading)
    await page.keyboard.press('Enter')

    const paragraph = `Body text with details ${Date.now()}`
    await page.keyboard.type(paragraph)
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /bullet/i)
    const bullet1 = `Bullet item alpha ${Date.now()}`
    await page.keyboard.type(bullet1)
    await page.keyboard.press('Enter')
    const bullet2 = `Bullet item beta ${Date.now()}`
    await page.keyboard.type(bullet2)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await selectSlashItem(page, /code/i)
    const code = `const x = ${Date.now()}`
    await page.keyboard.type(code)

    await expect(editor).toContainText(heading)
    await expect(editor).toContainText(paragraph)
    await expect(editor).toContainText(bullet1)
    await expect(editor).toContainText(bullet2)
    await expect(editor).toContainText(code)

    await openItem(page, notes.midInsert)
    await expect(await getEditor(page)).toBeVisible()

    await openItem(page, notes.complex)
    const editorAfter = await getEditor(page)
    await expect(editorAfter).toContainText(heading, { timeout: 15000 })
    await expect(editorAfter).toContainText(paragraph, { timeout: 15000 })
    await expect(editorAfter).toContainText(bullet1, { timeout: 15000 })
    await expect(editorAfter).toContainText(bullet2, { timeout: 15000 })
    await expect(editorAfter).toContainText(code, { timeout: 15000 })

    await expect(
      editorAfter.locator('[data-content-type="heading"]').first(),
    ).toBeVisible()
    await expect(
      editorAfter.locator('li, [data-content-type="bulletListItem"]').first(),
    ).toBeVisible()
    await expect(
      editorAfter.locator('[data-content-type="codeBlock"]').first(),
    ).toBeVisible()
  })
})
