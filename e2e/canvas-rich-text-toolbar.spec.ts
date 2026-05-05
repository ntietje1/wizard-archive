import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  getCanvasNodesByType,
  openCanvas,
  selectCanvasTool,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('CnvRichText')
const canvasName = DEFAULT_CANVAS_NAME
const editorSelector = '[aria-label="Text node content"][contenteditable="true"]'

test.describe.serial('canvas rich text toolbar workflows', () => {
  test.setTimeout(60_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)
    await page.close()
    await context.close()
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

  test.beforeEach(async ({ page }) => {
    await enableCanvasRuntime(page)
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)
    await waitForCanvasRuntime(page)
    await clearCanvasViaRuntime(page)
  })

  test('formats selected text and preserves formatting controls after reload', async ({ page }) => {
    const editor = await createEditableTextNode(page, 'Rich toolbar text')
    await selectAllEditorText(page, editor)

    const toolbar = page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await toolbar.getByRole('button', { name: 'Italic' }).click()
    await toolbar.getByRole('button', { name: 'Align center' }).click()

    await toolbar.getByRole('button', { name: 'Block type' }).click({ force: true })
    await page.getByRole('menuitemradio', { name: 'Heading 2' }).click()
    await toolbar.getByRole('button', { name: 'Text color' }).click({ force: true })
    await page.getByRole('menuitemradio', { name: 'Select Red text color' }).click()

    await page.reload()
    await waitForCanvasRuntime(page)
    await expect(page.getByText('Rich toolbar text', { exact: true })).toBeVisible({
      timeout: 10_000,
    })

    await getCanvasNodesByType(page, 'text').first().dblclick()
    const reopenedEditor = page.locator(editorSelector).last()
    await selectAllEditorText(page, reopenedEditor)
    await expect(page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
  })

  test('keeps canvas shortcuts suppressed while editing and toolbar menus are active', async ({
    page,
  }) => {
    const editor = await createEditableTextNode(page, 'Shortcut text')
    await selectAllEditorText(page, editor)

    const beforeCount = await getCanvasNodesByType(page, 'text').count()
    await page.keyboard.press('Delete')
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(beforeCount)

    const toolbar = page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    await toolbar.getByRole('button', { name: 'Text color' }).click()
    await expect(page.getByRole('menuitemradio', { name: 'Select Blue text color' })).toBeVisible()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(beforeCount)
  })
})

async function createEditableTextNode(page: Page, text: string) {
  await selectCanvasTool(page, 'Text')
  await clickCanvasAt(page, { x: 760, y: 520 })
  const editor = page.locator(editorSelector).last()
  await expect(editor).toBeVisible()
  await editor.fill(text)
  return editor
}

async function selectAllEditorText(page: Page, editor: ReturnType<Page['locator']>) {
  await editor.click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
}
