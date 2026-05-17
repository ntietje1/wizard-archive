import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createFreshCanvasForTest,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodes,
  seedCanvasEmbedNodeViaRuntime,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import { getEditor } from './helpers/editor-helpers'
import { getCampaignIdFromRoute, getSidebarItemIdBySlug } from './helpers/convex-helpers'
import { getBrowserPrimaryModifier, pressRedo, pressUndo } from './helpers/keyboard-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import type { Page } from '@playwright/test'
import type { Id } from 'convex/_generated/dataModel'

const campaignName = testName('URHotkeys')

test.describe.serial('undo and redo hotkeys in editor surfaces', () => {
  test.setTimeout(90_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test('routes undo and redo to the active note editor', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const noteName = `Undo Note ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()

    const baseText = 'Base'
    const text = 'N'
    await page.keyboard.type(baseText)
    await expect(editor).toContainText(baseText)
    await waitForEditorToSettle(page)
    await page.keyboard.type(text)
    await expect(editor).toContainText(`${baseText}${text}`)

    await pressUndo(page)
    await expect(editor).not.toContainText(text, { timeout: 5000 })
    await expect(editor).toContainText(baseText)

    await pressNoteRedo(page)
    await expect(editor).toContainText(`${baseText}${text}`, { timeout: 5000 })
  })

  test('keeps the note cursor in the edited paragraph after undo and redo', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const noteName = `Undo Cursor Note ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.type('Top')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Middle')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Bottom')
    await expect(editor).toContainText('Top')
    await expect(editor).toContainText('Middle')
    await expect(editor).toContainText('Bottom')
    await waitForEditorToSettle(page)

    await placeCaretAfterText(editor, 'Middle')
    await page.keyboard.type('X')
    await expect(editor).toContainText('MiddleX')
    await expect.poll(() => getSelectionTextBlock(page, editor)).toContain('MiddleX')

    await pressUndo(page)
    await expect(editor).toContainText('Middle')
    await expect(editor).not.toContainText('MiddleX')
    await expect.poll(() => getSelectionTextBlock(page, editor)).toContain('Middle')

    await pressNoteRedo(page)
    await expect(editor).toContainText('MiddleX')
    await expect.poll(() => getSelectionTextBlock(page, editor)).toContain('MiddleX')
  })

  test('restores note selection after repeated undo and redo', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const noteName = `Undo Selection Roundtrip Note ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.type('Top')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Middle')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Bottom')
    await waitForEditorToSettle(page)

    await placeCaretAfterText(editor, 'Top')
    await page.keyboard.type('A')
    await expect(editor).toContainText('TopA')
    await waitForEditorToSettle(page)

    await placeCaretAfterText(editor, 'Middle')
    await page.keyboard.type('Z')
    await expect(editor).toContainText('MiddleZ')
    await waitForEditorToSettle(page)

    await selectText(editor, 'Bottom')
    await expect.poll(() => getSelectedText(page)).toBe('Bottom')

    await pressUndo(page)
    await expect.poll(() => getEditorText(editor)).not.toContain('MiddleZ')
    await pressUndo(page)
    await expect.poll(() => getEditorText(editor)).not.toContain('TopA')
    await pressNoteRedo(page)
    await expect.poll(() => getEditorText(editor)).toContain('TopA')
    await pressNoteRedo(page)
    await expect.poll(() => getEditorText(editor)).toContain('MiddleZ')

    await expect.poll(() => getSelectedText(page)).toBe('Bottom')
  })

  test('restores the exact note text and multi-line selection after repeated undo and redo pairs', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const noteName = `Undo Exact Selection Note ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.type('Alpha')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Beta')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Gamma')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Delta')
    await waitForEditorToSettle(page)

    await placeCaretAfterText(editor, 'Alpha')
    await page.keyboard.type('X')
    await expect(editor).toContainText('AlphaX')
    await waitForEditorToSettle(page)

    await placeCaretAfterText(editor, 'Delta')
    await page.keyboard.type('Y')
    await expect(editor).toContainText('DeltaY')
    await waitForEditorToSettle(page)

    await selectTextRange(editor, 'Beta', 'Gamma')
    const expected = await getEditorSelectionSnapshot(editor)

    await pressUndo(page)
    await expect.poll(() => getEditorText(editor)).not.toContain('DeltaY')
    await pressNoteRedo(page)
    await expect.poll(() => getEditorSelectionSnapshot(editor)).toEqual(expected)

    await pressUndo(page)
    await expect.poll(() => getEditorText(editor)).not.toContain('DeltaY')
    await pressNoteRedo(page)
    await expect.poll(() => getEditorSelectionSnapshot(editor)).toEqual(expected)
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } finally {
      await page.close()
      await context.close()
    }
  })

  test('routes undo and redo to the active canvas text node editor', async ({ page }) => {
    await openFreshRuntimeCanvas(page, `Undo Text Canvas ${Date.now()}`)
    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 360, y: 260 })

    const editor = page.locator('[aria-label="Text node content"][contenteditable="true"]')
    await expect(editor).toHaveCount(1)
    await expect(editor).toBeVisible()

    const text = 'T'
    await page.keyboard.type(text)
    await expect(editor).toContainText(text)

    await pressUndo(page)
    await expect(editor).not.toContainText(text, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)

    await pressRedo(page)
    await expect(editor).toContainText(text, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
  })

  test('routes undo and redo to the active embedded note editor', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    const noteName = `Undo Embed Note ${Date.now()}`
    await createNote(page, noteName)
    const noteId = await getCurrentNoteId(page)

    await openFreshRuntimeCanvas(page, `Undo Embed Canvas ${Date.now()}`)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embedded-note-undo',
      sidebarItemId: noteId,
      position: { x: 220, y: 180 },
      width: 420,
      height: 280,
    })

    await getCanvasNodeById(page, 'embedded-note-undo').dblclick()
    await expect(page.getByTestId('embed-note-content-wrapper')).toBeVisible({ timeout: 15_000 })

    const embeddedEditor = page
      .getByTestId('embed-note-content-wrapper')
      .locator('[contenteditable="true"]')
      .first()
    await expect(embeddedEditor).toBeVisible({ timeout: 15_000 })
    await waitForEditorToSettle(page)

    const baseText = 'Base'
    const text = 'E'
    await embeddedEditor.click()
    await page.keyboard.type(baseText)
    await expect(embeddedEditor).toContainText(baseText)
    await waitForEditorToSettle(page)
    await page.keyboard.type(text)
    await expect(embeddedEditor).toContainText(`${baseText}${text}`)

    await pressUndo(page)
    await expect(embeddedEditor).not.toContainText(text, { timeout: 5000 })
    await expect(embeddedEditor).toContainText(baseText)
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)

    await pressNoteRedo(page)
    await expect(embeddedEditor).toContainText(`${baseText}${text}`, { timeout: 5000 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
  })
})

async function openFreshRuntimeCanvas(page: Page, canvasName: string) {
  await enableCanvasRuntime(page)
  await createFreshCanvasForTest(page, campaignName, canvasName)
  await clearCanvasViaRuntime(page)
  await selectCanvasTool(page, 'Pointer')
}

async function getCurrentNoteId(page: Page): Promise<Id<'sidebarItems'>> {
  const noteSlug = getCurrentItemSlug(page)
  const { dmUsername, campaignSlug } = getCurrentCampaignRoute(page)
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  return await getSidebarItemIdBySlug({ campaignId, slug: noteSlug })
}

function getCurrentCampaignRoute(page: Page) {
  const url = new URL(page.url())
  const [, campaignsSegment, dmUsername, campaignSlug] = url.pathname.split('/')
  if (campaignsSegment !== 'campaigns' || !dmUsername || !campaignSlug) {
    throw new Error(`Expected a campaign route, received ${url.pathname}`)
  }
  return { dmUsername, campaignSlug }
}

function getCurrentItemSlug(page: Page) {
  const itemSlug = new URL(page.url()).searchParams.get('item')
  if (!itemSlug) {
    throw new Error(`Expected an item slug in ${page.url()}`)
  }
  return itemSlug
}

async function waitForEditorToSettle(page: Page) {
  await page.waitForTimeout(1000)
}

async function pressNoteRedo(page: Page) {
  const modifier = await getBrowserPrimaryModifier(page)
  if (modifier === 'Meta') {
    await page.keyboard.press('Meta+Shift+Z')
    return
  }

  await page.keyboard.press('Control+Y')
}

async function placeCaretAfterText(editor: Awaited<ReturnType<typeof getEditor>>, text: string) {
  await editor.evaluate((root, targetText) => {
    const findTextNode = (nodeRoot: Node, textToFind: string) => {
      const walker = document.createTreeWalker(nodeRoot, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      while (node) {
        if (node.textContent?.includes(textToFind)) return node
        node = walker.nextNode()
      }
      return null
    }

    const textNode = findTextNode(root, targetText)
    if (!textNode) throw new Error(`Could not find text node containing ${targetText}`)

    const offset = textNode.textContent?.indexOf(targetText) ?? -1
    if (offset === -1) throw new Error(`Could not find text offset for ${targetText}`)

    const range = document.createRange()
    range.setStart(textNode, offset + targetText.length)
    range.collapse(true)

    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    ;(root as HTMLElement).focus()
    document.dispatchEvent(new Event('selectionchange'))
  }, text)
}

async function selectText(editor: Awaited<ReturnType<typeof getEditor>>, text: string) {
  await selectTextRange(editor, text, text)
}

async function selectTextRange(
  editor: Awaited<ReturnType<typeof getEditor>>,
  startText: string,
  endText: string,
) {
  await editor.evaluate(
    (root, textRange) => {
      const findTextNode = (nodeRoot: Node, textToFind: string) => {
        const walker = document.createTreeWalker(nodeRoot, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          if (node.textContent?.includes(textToFind)) return node
          node = walker.nextNode()
        }
        return null
      }

      const startNode = findTextNode(root, textRange.startText)
      const endNode = findTextNode(root, textRange.endText)
      if (!startNode) throw new Error(`Could not find text node containing ${textRange.startText}`)
      if (!endNode) throw new Error(`Could not find text node containing ${textRange.endText}`)

      const startOffset = startNode.textContent?.indexOf(textRange.startText) ?? -1
      const endOffset = endNode.textContent?.indexOf(textRange.endText) ?? -1
      if (startOffset === -1) {
        throw new Error(`Could not find text offset for ${textRange.startText}`)
      }
      if (endOffset === -1) throw new Error(`Could not find text offset for ${textRange.endText}`)

      const range = document.createRange()
      range.setStart(startNode, startOffset)
      range.setEnd(endNode, endOffset + textRange.endText.length)

      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      ;(root as HTMLElement).focus()
      document.dispatchEvent(new Event('selectionchange'))
    },
    { startText, endText },
  )
}

async function getSelectedText(page: Page) {
  return await page.evaluate(() => window.getSelection()?.toString() ?? '')
}

async function getEditorText(editor: Awaited<ReturnType<typeof getEditor>>) {
  return await editor.evaluate((root) => root.textContent ?? '')
}

async function getEditorSelectionSnapshot(editor: Awaited<ReturnType<typeof getEditor>>) {
  return await editor.evaluate((root) => {
    const selection = window.getSelection()
    const anchorNode = selection?.anchorNode ?? null
    const focusNode = selection?.focusNode ?? null

    const getRootTextOffset = (targetNode: Node | null, targetOffset: number) => {
      if (!targetNode || !root.contains(targetNode)) return null

      const range = document.createRange()
      range.setStart(root, 0)
      range.setEnd(targetNode, targetOffset)
      return range.toString().length
    }

    return {
      text: root.textContent ?? '',
      selectedText: selection?.toString() ?? '',
      anchorOffset: getRootTextOffset(anchorNode, selection?.anchorOffset ?? 0),
      focusOffset: getRootTextOffset(focusNode, selection?.focusOffset ?? 0),
      isCollapsed: selection?.isCollapsed ?? true,
    }
  })
}

async function getSelectionTextBlock(_page: Page, editor: Awaited<ReturnType<typeof getEditor>>) {
  return await editor.evaluate((root) => {
    const selection = window.getSelection()
    const anchorNode = selection?.anchorNode
    if (!anchorNode || !root.contains(anchorNode)) return null

    const element =
      anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement
    return element?.closest('[data-content-type]')?.textContent ?? anchorNode.textContent ?? null
  })
}
