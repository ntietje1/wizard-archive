import { expect, test } from '@playwright/test'
import { sidebarResource } from './helpers/editor-resource-helpers'
import type { Locator, Page } from '@playwright/test'

test.describe('canvas rich text', () => {
  test('keeps embedded and canvas-text block controls inside the active editor', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    const canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    await expect(canvas).toBeVisible()
    const surface = canvas.getByRole('region', { name: 'Canvas surface' })

    await sidebarResource(page, 'Harbor Heist Board').click()
    await page
      .getByRole('button', { name: 'The Lantern Market', exact: true })
      .dragTo(surface, { targetPosition: { x: 420, y: 280 } })
    const noteEditor = canvas
      .getByRole('textbox', { name: 'The Lantern Market embedded note' })
      .last()
    const noteBlock = noteEditor.locator('[data-node-type="blockContainer"]').first()
    await noteBlock.dblclick()
    await expect(page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
    await noteBlock.hover()
    const noteDragHandle = page.locator('[data-block-drag-actions="note"]')
    await expect(noteDragHandle).toBeVisible()
    await noteDragHandle.click()
    await expect(page.getByRole('menuitem', { name: 'Copy link to block' })).toBeVisible()
    await page.keyboard.press('Escape')
    await noteBlock.dblclick()
    await noteBlock.hover()
    await expect(noteDragHandle).toBeVisible()
    const noteTransfer = await page.evaluateHandle(() => new DataTransfer())
    await noteDragHandle.dispatchEvent('dragstart', { dataTransfer: noteTransfer })
    await expect(page.locator('.bn-drag-preview')).toBeVisible()
    await noteDragHandle.dispatchEvent('dragend', { dataTransfer: noteTransfer })

    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    const freshCanvas = page.getByRole('application', {
      name: 'Harbor Heist Board canvas editor',
    })
    await expect(freshCanvas).toBeVisible()
    const freshSurface = freshCanvas.getByRole('region', { name: 'Canvas surface' })
    await freshCanvas.getByRole('button', { name: 'Text', exact: true }).click()
    const surfaceBox = await freshSurface.boundingBox()
    if (!surfaceBox) throw new Error('Canvas surface is not visible')
    await page.mouse.click(surfaceBox.x + 700, surfaceBox.y + 420)
    const textEditor = freshCanvas.getByRole('textbox', { name: 'Canvas text' }).last()
    await textEditor.fill('Canvas block controls')
    const textBlock = textEditor.locator('[data-node-type="blockContainer"]').first()
    await textBlock.hover()
    const textDragHandle = page.locator('[data-block-drag-actions="canvas-text"]')
    await expect(textDragHandle).toBeVisible()
    await textDragHandle.click()
    await expect(textDragHandle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy link to block' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Comment' })).toHaveCount(0)
  })

  test('reorders blocks within embedded note and canvas text editors', async ({ page }) => {
    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    let canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    await expect(canvas).toBeVisible()
    let surface = canvas.getByRole('region', { name: 'Canvas surface' })

    await sidebarResource(page, 'Harbor Heist Board').click()
    await page
      .getByRole('button', { name: 'The Lantern Market', exact: true })
      .dragTo(surface, { targetPosition: { x: 420, y: 280 } })
    const noteEditor = canvas
      .getByRole('textbox', { name: 'The Lantern Market embedded note' })
      .last()
    const noteBlocks = noteEditor.locator('[data-node-type="blockContainer"]')
    const secondNoteBlockText = await noteBlocks.nth(1).textContent()
    await noteBlocks.first().dblclick()
    await expect(canvas.getByTestId('canvas-selection-resize-wrapper')).toHaveCount(0)
    await noteBlocks.nth(1).hover()
    const noteDragHandle = page.locator('[data-block-drag-actions="note"]')
    await expect(noteDragHandle).toBeVisible()
    await dispatchBlockDrag(page, noteDragHandle, noteBlocks.first())
    await expect(noteBlocks.first()).toHaveText(secondNoteBlockText ?? '')
    await expect(noteEditor).toHaveAttribute('contenteditable', 'true')

    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    await expect(canvas).toBeVisible()
    surface = canvas.getByRole('region', { name: 'Canvas surface' })
    await canvas.getByRole('button', { name: 'Text', exact: true }).click()
    const surfaceBox = await surface.boundingBox()
    if (!surfaceBox) throw new Error('Canvas surface is not visible')
    await page.mouse.click(surfaceBox.x + 700, surfaceBox.y + 420)
    const textEditor = canvas.getByRole('textbox', { name: 'Canvas text' }).last()
    await expect(canvas.getByTestId('canvas-selection-resize-wrapper')).toHaveCount(0)
    await textEditor.fill('First block')
    await textEditor.press('Enter')
    await page.keyboard.type('Second block')
    const textBlocks = textEditor.locator('[data-node-type="blockContainer"]')
    const firstTextBlock = textBlocks.filter({ hasText: 'First block' }).first()
    const secondTextBlock = textBlocks.filter({ hasText: 'Second block' }).first()
    await secondTextBlock.hover()
    const textDragHandle = page.locator('[data-block-drag-actions="canvas-text"]')
    await expect(textDragHandle).toBeVisible()
    await dispatchBlockDrag(page, textDragHandle, firstTextBlock)
    await expect(textBlocks.first()).toContainText('Second block')
    await expect(textEditor).toHaveAttribute('contenteditable', 'true')
  })

  test('places text and embedded-note carets at the double-click point', async ({ page }) => {
    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    const canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    await expect(canvas).toBeVisible()

    await canvas.getByRole('button', { name: 'Text' }).click()
    const surface = canvas.getByRole('region', { name: 'Canvas surface' })
    const surfaceBox = await surface.boundingBox()
    if (!surfaceBox) throw new Error('Canvas surface is not visible')
    await page.mouse.click(surfaceBox.x + 700, surfaceBox.y + 420)
    const textNode = canvas.getByTestId('canvas-node').last()
    const textEditor = textNode.getByRole('textbox', { name: 'Canvas text' })
    await textEditor.fill('Alpha beta gamma')
    await textEditor.press('Escape')
    const textLine = textEditor.locator('.bn-inline-content').first()
    const textLineBox = await textLine.boundingBox()
    if (!textLineBox) throw new Error('Canvas text line is not visible')
    await textLine.dblclick({ position: { x: textLineBox.width - 2, y: textLineBox.height / 2 } })
    await page.keyboard.type('!')
    await expect(textEditor).toContainText('Alpha beta gamma!')

    await textEditor.press('Escape')
    await sidebarResource(page, 'Harbor Heist Board').click()
    await page
      .getByRole('button', { name: 'The Lantern Market', exact: true })
      .dragTo(surface, { targetPosition: { x: 420, y: 280 } })
    const noteEditor = canvas
      .getByRole('textbox', { name: 'The Lantern Market embedded note' })
      .last()
    await expect(noteEditor).toBeVisible()
    const noteLine = noteEditor.locator('.bn-inline-content').first()
    const originalNoteText = await noteLine.textContent()
    const noteTarget = await noteLine.evaluate((element) => {
      const text = element.firstChild
      if (!(text instanceof Text) || text.length === 0) throw new Error('Expected note text')
      const range = document.createRange()
      range.setStart(text, text.length - 1)
      range.setEnd(text, text.length)
      const character = range.getBoundingClientRect()
      const line = element.getBoundingClientRect()
      return {
        nativeOffset: document.caretPositionFromPoint(
          character.right - 1,
          character.top + character.height / 2,
        )?.offset,
        position: {
          x: character.right - line.left - 1,
          y: character.top - line.top + character.height / 2,
        },
      }
    })
    expect(noteTarget.nativeOffset).toBe(originalNoteText?.length)
    await noteLine.dblclick({ position: noteTarget.position })
    await expect
      .poll(() =>
        noteLine.evaluate(() => {
          const selection = window.getSelection()
          return selection?.anchorOffset ?? -1
        }),
      )
      .toBe(originalNoteText?.length)
    await page.keyboard.type('!')
    await expect(noteLine).toHaveText(`${originalNoteText}!`)
  })

  test('formats canonical text and preserves it across editor and resource lifecycles', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await sidebarResource(page, 'Harbor Heist Board').click()
    const canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    const nodes = canvas.getByTestId('canvas-node')
    await expect(nodes).toHaveCount(2)

    await canvas.getByRole('button', { name: 'Text' }).click()
    const surface = canvas.getByRole('region', { name: 'Canvas surface' })
    const bounds = await surface.boundingBox()
    if (!bounds) throw new Error('Canvas surface is not visible')
    await page.mouse.click(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.55)
    await expect(nodes).toHaveCount(3)

    const editor = nodes.last().getByRole('textbox', { name: 'Canvas text' })
    await expect(editor).toBeVisible()
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    await editor.press('Escape')
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    await nodes.last().dblclick()
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    const editorElement = await editor.elementHandle()
    if (!editorElement) throw new Error('Canvas text editor is not mounted')
    await editor.fill('Rich toolbar text')
    await editor.press('Control+A')

    const toolbar = page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    await expect(toolbar).toBeVisible()
    await editor
      .locator('p, h1, h2, h3')
      .first()
      .click({ modifiers: ['Control'] })
    await expect(editor.locator('.ProseMirror-selectednode')).toHaveCount(0)
    await editor.press('Control+A')
    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await toolbar.getByRole('button', { name: 'Italic' }).click()
    await toolbar.getByRole('button', { name: 'Align center' }).click()
    await toolbar.getByRole('button', { name: 'Block type' }).click()
    await page.getByRole('menuitemradio', { name: 'Heading 2', exact: true }).click()
    await toolbar.getByRole('button', { name: 'Text color' }).click()
    await page.getByRole('button', { name: 'Select Red text color' }).click()

    await editor.press('Escape')
    expect(
      await editorElement.evaluate((element) => ({
        connected: element.isConnected,
        editable: element.getAttribute('contenteditable'),
      })),
    ).toEqual({ connected: true, editable: 'false' })
    const formattedText = nodes.last().getByText('Rich toolbar text', { exact: true })
    await expect(
      nodes.last().getByRole('heading', { level: 2, name: 'Rich toolbar text' }),
    ).toBeVisible()
    await expect(formattedText).toHaveAttribute('data-value', 'var(--t-red)')
    await expect(formattedText).toHaveCSS('font-style', 'italic')
    expect(await formattedText.evaluate((element) => element.closest('strong') !== null)).toBe(true)

    await sidebarResource(page, 'Moonwell Docks').click()
    await sidebarResource(page, 'Harbor Heist Board').click()
    const reopenedCanvas = page.getByRole('application', {
      name: 'Harbor Heist Board canvas editor',
    })
    const reopenedNode = reopenedCanvas.getByTestId('canvas-node').last()
    await expect(
      reopenedNode.getByRole('heading', { level: 2, name: 'Rich toolbar text' }),
    ).toBeVisible()

    await reopenedNode.dblclick()
    const reopenedEditor = reopenedNode.getByRole('textbox', { name: 'Canvas text' })
    await reopenedEditor.getByRole('heading', { level: 2, name: 'Rich toolbar text' }).click()
    await reopenedEditor.press('Control+A')
    await expect(page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
  })
})

async function dispatchBlockDrag(page: Page, handle: Locator, target: Locator) {
  const sourceBox = await handle.boundingBox()
  const targetBox = await target.boundingBox()
  const nodeBox = await target
    .locator('xpath=ancestor::*[@data-testid="canvas-node"][1]')
    .boundingBox()
  if (!sourceBox || !targetBox || !nodeBox) {
    throw new Error('Block drag source, target, or canvas node is not visible')
  }
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  try {
    await page.mouse.move(targetBox.x + 16, Math.max(targetBox.y + 1, nodeBox.y + 2), {
      steps: 18,
    })
  } finally {
    await page.mouse.up()
  }
  const settledNodeBox = await target
    .locator('xpath=ancestor::*[@data-testid="canvas-node"][1]')
    .boundingBox()
  expect(settledNodeBox).toMatchObject({ x: nodeBox.x, y: nodeBox.y })
}
