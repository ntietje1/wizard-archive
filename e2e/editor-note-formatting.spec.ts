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
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    const editor = await openNoteEditor(page)

    await appendParagraph(page, editor)
    const clipboardPassage = 'Clipboard passage'
    await page.keyboard.type(clipboardPassage)
    const sourceParagraph = editor.locator('p', { hasText: 'Clipboard passage' }).last()
    await selectTextWithMouse(page, sourceParagraph)
    await page.keyboard.press('Control+c')
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText().then((text) => text.trim())))
      .toBe('Clipboard passage')
    await sourceParagraph.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' ')
    await page.keyboard.press('Control+v')
    await expect(sourceParagraph).toHaveText('Clipboard passage Clipboard passage')

    await appendParagraph(page, editor)
    await page.keyboard.type('/value')
    await page.getByRole('option', { name: /^Value/ }).click()
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Control+c')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.type(' ')
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

    await appendParagraph(page, editor)
    await insertSlashBlock(page, 'Heading 1', 'Authoring heading')
    await page.keyboard.press('Enter')
    await insertSlashBlock(page, 'Quote', 'A quoted passage')
    await page.keyboard.press('Enter')
    await insertSlashBlock(page, 'Code Block', 'const answer = 42')
    await page.keyboard.press('Shift+Enter')
    await insertSlashBlock(page, 'Check List', 'Review clues')
    await exitList(page)
    await insertSlashBlock(page, 'Toggle List', 'Optional details')
    await exitList(page)
    await insertSlashBlock(page, 'Bullet List', 'Parent item')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Nested item')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await insertSlashBlock(page, 'Numbered List', 'First step')
    await exitList(page)
    await insertSlashBlock(page, 'Divider')
    await page.keyboard.press('ArrowDown')
    await insertSlashBlock(page, 'Table')

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

  test('filters slash commands and exposes the custom block menu', async ({ page }) => {
    const editor = await openNoteEditor(page)
    await expect(editor).not.toBeFocused()

    await appendParagraph(page, editor)
    await page.keyboard.type('/heading 3')
    const slashMenu = page.getByRole('listbox')
    await expect(slashMenu).toBeVisible()
    await expect(slashMenu.getByRole('option', { name: /^Heading 3/ })).toBeVisible()
    await expect(slashMenu.getByRole('option', { name: /^Quote/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    const block = editor.locator('[data-node-type="blockContainer"]').last()
    await block.hover()
    const dragHandle = page.getByRole('button', { name: 'Drag block' })
    await expect(dragHandle).toBeVisible()
    await expect(dragHandle).toHaveAttribute('draggable', 'true')
    await expect(page.getByRole('button', { name: 'Add block' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open block menu' })).toHaveCount(0)
    await dragHandle.dispatchEvent('mousedown', { button: 0 })
    await expect(page.getByRole('menuitem', { name: 'Turn into' })).toHaveCount(0)
    await dragHandle.click()
    const blockMenu = page.getByTestId('block-drag-handle-menu')
    await expect(blockMenu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Turn into' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Color' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy link to block' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Comment' })).toBeVisible()
    await expect(page.getByText(/drag\s+to move/i)).toHaveCount(0)
    await expect(page.getByText(/click\s+to open menu/i)).toHaveCount(0)
    const dragHandleBox = await dragHandle.boundingBox()
    const menuBox = await blockMenu.boundingBox()
    if (!dragHandleBox || !menuBox) throw new Error('Expected custom block menu geometry')
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(dragHandleBox.x + 1)
    await page.keyboard.press('Escape')

    await assertEditorOwnsViewportWhitespace(page)
  })

  test('executes custom block conversion, color, duplicate, and delete commands', async ({
    page,
  }) => {
    const editor = await openNoteEditor(page)
    await appendParagraph(page, editor)
    await page.keyboard.type('Custom menu block')
    const authoredBlock = editor
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: 'Custom menu block' })

    await authoredBlock.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Turn into' }).hover()
    await page.getByRole('menuitem', { name: 'Heading 2', exact: true }).click()
    await expect(editor.getByRole('heading', { name: 'Custom menu block', level: 2 })).toBeVisible()

    await authoredBlock.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Color' }).hover()
    await page.getByRole('menuitem', { name: 'Blue text' }).click()
    await expect(
      authoredBlock.locator('.bn-block-content[data-text-color="var(--t-blue)"]'),
    ).toBeVisible()

    await authoredBlock.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(
      editor.locator('[data-node-type="blockContainer"]').filter({ hasText: 'Custom menu block' }),
    ).toHaveCount(2)

    const duplicatedBlock = editor
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: 'Custom menu block' })
      .last()
    await duplicatedBlock.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(
      editor.locator('[data-node-type="blockContainer"]').filter({ hasText: 'Custom menu block' }),
    ).toHaveCount(1)
  })

  test('keeps future custom block actions explicit without inventing parallel models', async ({
    page,
  }) => {
    const editor = await openNoteEditor(page)
    const block = editor.locator('[data-node-type="blockContainer"]').last()
    const initialBlockCount = await editor
      .locator(':scope > .bn-block-group > .bn-block-outer')
      .count()
    const initialText = await editor.textContent()
    const initialUrl = page.url()

    await block.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Copy link to block' }).click()
    await expect(page.getByRole('menuitem', { name: 'Copy link to block' })).toHaveCount(0)

    await block.hover()
    await page.getByRole('button', { name: 'Drag block' }).click()
    await page.getByRole('menuitem', { name: 'Comment' }).click()
    await expect(page.getByRole('menuitem', { name: 'Comment' })).toHaveCount(0)
    await expect(editor.locator(':scope > .bn-block-group > .bn-block-outer')).toHaveCount(
      initialBlockCount,
    )
    await expect(editor).toHaveText(initialText ?? '')
    expect(page.url()).toBe(initialUrl)
  })

  test('moves blocks through the custom drag handle', async ({ page }) => {
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
    const dragHandle = page.getByRole('button', { name: 'Drag block' })
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
    expect(await dataTransfer.evaluate((transfer) => [...transfer.types])).toContain(
      'application/x-wizard-archive-internal-drag',
    )
    const dragPreview = page.locator('.bn-drag-preview')
    await expect(dragPreview).toHaveCSS('opacity', '1')
    await expect(dragPreview).toContainText('Second draggable block')
    const dragPreviewBox = await dragPreview.boundingBox()
    if (!dragPreviewBox) throw new Error('Expected native drag preview geometry')
    expect(dragPreviewBox.width).toBeGreaterThan(0)
    expect(dragPreviewBox.height).toBeGreaterThan(0)
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
  const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
  await expect(workspace).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByRole('textbox', { name: 'New resource title' }).fill('Formatting scratchpad')
  await page.getByRole('menuitem', { name: 'Note' }).click()
  await expect(page.getByRole('heading', { name: 'Formatting scratchpad' })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'Formatting scratchpad note editor' })
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
  const inlineContents = editor.locator('.bn-inline-content')
  const nonEmptyInlineContents = inlineContents.filter({ hasText: /\S/ })
  const inlineContent =
    (await nonEmptyInlineContents.count()) > 0
      ? nonEmptyInlineContents.last()
      : inlineContents.last()
  const blockType = await inlineContent.evaluate(
    (element) => element.closest('[data-content-type]')?.getAttribute('data-content-type') ?? null,
  )
  await inlineContent.click()
  await page.keyboard.press('Control+End')
  if (blockType === 'codeBlock') {
    await page.keyboard.press('Shift+Enter')
  } else {
    await page.keyboard.press('Enter')
    if (
      blockType === 'bulletListItem' ||
      blockType === 'checkListItem' ||
      blockType === 'numberedListItem' ||
      blockType === 'toggleListItem'
    ) {
      await page.keyboard.press('Enter')
    }
  }
}

async function insertSlashBlock(page: Page, title: string, content?: string) {
  await page.keyboard.type('/')
  const menu = page.getByRole('listbox')
  await menu.getByRole('option', { name: new RegExp(`^${title}`) }).click()
  await expect(menu).toHaveCount(0)
  if (content) {
    await page.keyboard.type(content, { delay: 5 })
  }
}

async function exitList(page: Page) {
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
}

async function selectTextWithMouse(page: Page, text: Locator) {
  const bounds = await text.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rect = range.getBoundingClientRect()
    return { left: rect.left, right: rect.right, y: rect.top + rect.height / 2 }
  })
  await page.mouse.move(bounds.right - 1, bounds.y)
  await page.mouse.down()
  await page.mouse.move(bounds.left + 1, bounds.y, { steps: 8 })
  await page.mouse.up()
}
