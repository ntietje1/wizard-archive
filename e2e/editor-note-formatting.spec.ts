import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

test.describe('note authoring mechanics', () => {
  test('keeps the reference formatting toolbar active without losing the editor selection', async ({
    page,
  }) => {
    const editor = await openNoteEditor(page)
    const toolbar = page.getByRole('toolbar', { name: 'Note formatting toolbar' })
    await expect(toolbar).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Block type' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Text color' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Highlight color' })).toBeVisible()

    await appendParagraph(page, editor)
    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await page.keyboard.type('Toolbar bold passage')
    await toolbar.getByRole('button', { name: 'Bold' }).click()

    await expect(editor.locator('strong', { hasText: 'Toolbar bold passage' })).toBeVisible()
  })

  test('applies inline keyboard formatting', async ({ page }) => {
    const editor = await openNoteEditor(page)

    await appendParagraph(page, editor)
    await page.keyboard.press('Control+b')
    await page.keyboard.type('Bold passage')
    await page.keyboard.press('Control+b')
    await page.keyboard.type(' ')
    await page.keyboard.press('Control+i')
    await page.keyboard.type('Italic passage')
    await page.keyboard.press('Control+i')
    await page.keyboard.type(' ')
    await page.keyboard.press('Control+u')
    await page.keyboard.type('Underlined passage')
    await page.keyboard.press('Control+u')
    await page.keyboard.type(' ')
    await page.keyboard.press('Control+Shift+s')
    await page.keyboard.type('Struck passage')
    await page.keyboard.press('Control+Shift+s')

    await expect(editor.locator('strong', { hasText: 'Bold passage' })).toBeVisible()
    await expect(editor.locator('em', { hasText: 'Italic passage' })).toBeVisible()
    await expect(
      editor.locator('u, [style*="underline"]', { hasText: 'Underlined passage' }),
    ).toBeVisible()
    await expect(
      editor.locator('s, del, [style*="line-through"]', { hasText: 'Struck passage' }),
    ).toBeVisible()
  })

  test('undoes and redoes canonical editor commands through keyboard history', async ({ page }) => {
    const editor = await openNoteEditor(page)

    await appendParagraph(page, editor)
    await page.keyboard.type('/value')
    await page.getByRole('option', { name: /^Value/ }).click()
    const insertedValue = page.getByRole('button', { name: 'Value: 0' })
    await expect(insertedValue).toBeVisible()
    await expect(page.locator(':focus')).toHaveAttribute('contenteditable', 'true')
    await page.keyboard.press('Control+z')
    await expect(insertedValue).toHaveCount(0)
    await page.keyboard.press('Control+Shift+z')
    await expect(insertedValue).toBeVisible()
  })

  test('copies and pastes rich text while assigning copied Values new identities', async ({
    page,
  }) => {
    const editor = await openNoteEditor(page)

    await appendParagraph(page, editor)
    await page.keyboard.type('Clipboard passage')
    const sourceParagraph = editor.locator('p', { hasText: 'Clipboard passage' })
    await sourceParagraph.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    await page.keyboard.press('Control+c')
    await appendParagraph(page, editor)
    await page.keyboard.press('Control+v')
    await expect(editor.locator('p', { hasText: 'Clipboard passage' })).toHaveCount(2)

    await appendParagraph(page, editor)
    await page.keyboard.type('/value')
    await page.getByRole('option', { name: /^Value/ }).click()
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Control+c')
    await appendParagraph(page, editor)
    await page.keyboard.press('Control+v')

    const values = editor.locator('[data-note-value-id]')
    await expect(values).toHaveCount(2)
    const valueIds = await values.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-note-value-id')),
    )
    expect(new Set(valueIds).size).toBe(2)
  })

  test('creates the canonical rich block set and nests list items', async ({ page }) => {
    const editor = await openNoteEditor(page)

    await insertSlashBlock(page, editor, 'Heading 1', 'Authoring heading')
    await insertSlashBlock(page, editor, 'Quote', 'A quoted passage')
    await insertSlashBlock(page, editor, 'Code Block', 'const answer = 42')
    await insertSlashBlock(page, editor, 'Check List', 'Review clues')
    await insertSlashBlock(page, editor, 'Toggle List', 'Optional details')
    await insertSlashBlock(page, editor, 'Bullet List', 'Parent item')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Nested item')
    await page.keyboard.press('Tab')
    await insertSlashBlock(page, editor, 'Numbered List', 'First step')
    await insertSlashBlock(page, editor, 'Divider')
    await insertSlashBlock(page, editor, 'Table')

    await expect(editor.getByRole('heading', { name: 'Authoring heading', level: 1 })).toBeVisible()
    await expect(editor.locator('blockquote', { hasText: 'A quoted passage' })).toBeVisible()
    await expect(editor.locator('code', { hasText: 'const answer = 42' })).toBeVisible()
    await expect(
      editor.locator('[data-content-type="checkListItem"]', { hasText: 'Review clues' }),
    ).toBeVisible()
    await expect(
      editor.locator('[data-content-type="toggleListItem"]', { hasText: 'Optional details' }),
    ).toBeVisible()
    await expect(
      editor.locator('[data-content-type="numberedListItem"]', { hasText: 'First step' }),
    ).toBeVisible()
    await expect(editor.locator('[data-content-type="divider"]')).toBeVisible()
    await expect(editor.locator('[data-content-type="table"]')).toBeVisible()

    await expect(
      editor.locator('.bn-block-group .bn-block-group [data-content-type="bulletListItem"]', {
        hasText: 'Nested item',
      }),
    ).toBeVisible()
  })

  test('filters slash commands and exposes native block controls', async ({ page }) => {
    const editor = await openNoteEditor(page)
    await expect(editor).not.toBeFocused()

    await appendParagraph(page, editor)
    await page.keyboard.type('/heading 3')
    const menu = page.getByRole('listbox')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('option', { name: /^Heading 3/ })).toBeVisible()
    await expect(menu.getByRole('option', { name: /^Quote/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    const block = editor.locator('[data-node-type="blockContainer"]').last()
    await block.hover()
    await expect(page.getByRole('button', { name: 'Add block' })).toBeVisible()
    await page.getByRole('button', { name: 'Open block menu' }).click()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.keyboard.press('Escape')

    await assertEditorOwnsViewportWhitespace(page)
  })

  test('moves blocks through the native drag handle', async ({ page }) => {
    const editor = await openNoteEditor(page)
    await appendParagraph(page, editor)
    await page.keyboard.type('First draggable block')
    await appendParagraph(page, editor)
    await page.keyboard.type('Second draggable block')

    const firstBlock = editor
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: 'First draggable block' })
    const secondBlock = editor
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: 'Second draggable block' })
    await secondBlock.hover()
    const dragHandle = page.getByRole('button', { name: 'Open block menu' })
    await expect(dragHandle).toHaveAttribute('draggable', 'true')
    const dragHandleBox = await dragHandle.boundingBox()
    const firstBlockBox = await firstBlock.boundingBox()
    if (!dragHandleBox || !firstBlockBox) throw new Error('Expected draggable block geometry')
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
    await dragHandle.dispatchEvent('dragstart', {
      clientX: dragHandleBox.x + dragHandleBox.width / 2,
      clientY: dragHandleBox.y + dragHandleBox.height / 2,
      dataTransfer,
    })
    const drop = {
      clientX: firstBlockBox.x + 16,
      clientY: firstBlockBox.y + 1,
      dataTransfer,
    }
    await firstBlock.dispatchEvent('dragover', drop)
    await firstBlock.dispatchEvent('drop', drop)
    await dragHandle.dispatchEvent('dragend', { dataTransfer })
    await dataTransfer.dispose()

    await expect
      .poll(() =>
        editor
          .locator(':scope > .bn-block-group > .bn-block-outer')
          .evaluateAll((blocks) =>
            blocks
              .map((block) => block.textContent ?? '')
              .filter(
                (text) =>
                  text.includes('First draggable block') || text.includes('Second draggable block'),
              ),
          ),
      )
      .toEqual(['Second draggable block', 'First draggable block'])
  })
})

async function openNoteEditor(page: Page) {
  await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
  await page.getByRole('button', { name: 'The Lantern Market' }).click()
  const editor = page.getByRole('textbox', { name: 'The Lantern Market note editor' })
  await expect(editor).toBeVisible()
  return editor
}

async function assertEditorOwnsViewportWhitespace(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = document.querySelector('.resource-note-editor .bn-editor')
        const viewport = document.querySelector(
          '.resource-note-editor [data-slot="scroll-area-viewport"]',
        )
        if (!editor || !viewport) return { bottom: false, top: false }

        const editorRect = editor.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        const x = editorRect.left + editorRect.width / 2
        return {
          top: Boolean(document.elementFromPoint(x, editorRect.top + 4)?.closest('.bn-editor')),
          bottom: Boolean(
            document.elementFromPoint(x, viewportRect.bottom - 24)?.closest('.bn-editor'),
          ),
        }
      }),
    )
    .toEqual({ bottom: true, top: true })
}

async function appendParagraph(page: Page, editor: Locator) {
  const lastBlock = editor.locator(':scope > .bn-block-group > .bn-block-outer').last()
  await lastBlock.hover()
  const addBlock = page.getByRole('button', { name: 'Add block' })
  await expect(addBlock).toBeVisible()
  await addBlock.click()
}

async function insertSlashBlock(page: Page, editor: Locator, title: string, content?: string) {
  await appendParagraph(page, editor)
  await page.keyboard.type('/')
  const menu = page.getByRole('listbox')
  await menu.getByRole('option', { name: new RegExp(`^${title}`) }).click()
  await expect(menu).toHaveCount(0)
  if (content) {
    await page.keyboard.type(content, { delay: 5 })
    await page.waitForTimeout(100)
  }
}
