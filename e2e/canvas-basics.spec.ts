import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clickCanvasNode,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragOnCanvas,
  getCanvasNodesByType,
  getCanvasSurface,
  getCanvasToolButton,
  getCommittedSelectedCanvasNodes,
  getViewportControls,
  openCanvas,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('Canvas Basics')
const canvasName = DEFAULT_CANVAS_NAME
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

test.describe.serial('canvas basics', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
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

  test('create and reopen a canvas with toolbar and viewport chrome', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)

    await expect(getCanvasToolButton(page, 'Pointer')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Lasso select')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Draw')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Text')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Post-it')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Rectangle')).toBeVisible()

    const viewport = getViewportControls(page)
    await expect(viewport.zoomIn).toBeVisible()
    await expect(viewport.zoomOut).toBeVisible()
    await expect(viewport.fitZoom).toBeVisible()
    await expect(viewport.undo).toBeVisible()
    await expect(viewport.redo).toBeVisible()

    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(canvasName)
    await expect(getCanvasSurface(page)).toBeVisible()
  })

  test('place and edit text, sticky, and rectangle nodes', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 120, y: 120 })
    const textInput = page.getByLabel('Text node content')
    await expect(textInput).toBeVisible()
    await textInput.fill('Canvas text')
    await textInput.press('Enter')

    await selectCanvasTool(page, 'Post-it')
    await clickCanvasAt(page, { x: 320, y: 120 })
    const stickyInput = page.getByLabel('Sticky note text')
    await expect(stickyInput).toBeVisible()
    await stickyInput.fill('Sticky body')
    await stickyInput.press(`${mod}+Enter`)

    await selectCanvasTool(page, 'Rectangle')
    await dragOnCanvas(page, { x: 120, y: 260 }, { x: 280, y: 360 })
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)

    await selectCanvasTool(page, 'Rectangle')
    await dragOnCanvas(page, { x: 320, y: 260 }, { x: 326, y: 266 })
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)

    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(1)
    await expect.poll(() => getCanvasNodesByType(page, 'sticky').count()).toBe(1)
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Sticky body', { exact: true })).toBeVisible()

    await page.reload()
    await expect(getCanvasSurface(page)).toBeVisible()
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Sticky body', { exact: true })).toBeVisible()
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)
  })

  test('draw, select, clear, delete, and undo or redo', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Draw')
    await dragOnCanvas(page, { x: 430, y: 100 }, { x: 540, y: 200 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)

    await page.reload()
    await expect(getCanvasSurface(page)).toBeVisible()
    await selectCanvasTool(page, 'Pointer')
    const stickyNode = getCanvasNodesByType(page, 'sticky').first()
    await clickCanvasNode(page, stickyNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await clickCanvasAt(page, { x: 700, y: 520 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)

    const textNode = getCanvasNodesByType(page, 'text').first()
    await clickCanvasNode(page, textNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await page.keyboard.press('Delete')
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(0)

    const viewport = getViewportControls(page)
    await viewport.undo.click()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(1)

    await viewport.redo.click()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(0)
  })
})
