import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clickCanvasNode,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragCanvasNode,
  dragOnCanvas,
  endCanvasPointerGesture,
  getCanvasLassoOverlay,
  getCanvasMarqueeOverlay,
  getCanvasNodeBoundingBox,
  getCanvasNodesByType,
  getCanvasPendingPreviewActiveNodes,
  getCanvasPendingSelectionStatus,
  getCanvasToolButton,
  moveCanvasPointer,
  openCanvas,
  resizeCanvasNode,
  selectCanvasTool,
  startCanvasPointerGesture,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const campaignName = testName('Cnv Collab')
const canvasName = DEFAULT_CANVAS_NAME
const SHARED_TEXT_TIMEOUT_MS = 15_000
const TEXT_CONTENT_LOCATOR = '[aria-label="Text node content"][contenteditable="true"]'
const EMPTY_CANVAS_POINT = { x: 720, y: 520 }

test.describe.serial('canvas collaboration', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)
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
    } catch (error) {
      console.warn('Failed to delete canvas collaboration campaign during teardown', {
        campaignName,
        error,
      })
    }
    await page.close()
    await context.close()
  })

  test('syncs node creation, stroke drawing, dragging, and resizing across tabs', async ({
    browser,
  }) => {
    const collab = await createCollabContexts(browser)

    try {
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)

      await selectCanvasTool(collab.page1, 'Text')
      await clickCanvasAt(collab.page1, { x: 120, y: 120 })
      await collab.page1.locator(TEXT_CONTENT_LOCATOR).last().fill('Shared text')
      await clickCanvasAt(collab.page1, EMPTY_CANVAS_POINT)

      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(1)
      await expect(collab.page2.getByText('Shared text', { exact: true })).toBeVisible({
        timeout: SHARED_TEXT_TIMEOUT_MS,
      })
      await expect(getCanvasToolButton(collab.page1, 'Text')).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await clickCanvasAt(collab.page1, { x: 320, y: 120 })
      await collab.page1.locator(TEXT_CONTENT_LOCATOR).last().fill('Shared second text')
      await clickCanvasAt(collab.page1, EMPTY_CANVAS_POINT)
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(2)
      await expect(getCanvasToolButton(collab.page1, 'Text')).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await dragOnCanvas(collab.page1, { x: 260, y: 260 }, { x: 380, y: 360 })
      await collab.page1.locator(TEXT_CONTENT_LOCATOR).last().fill('Dragged shared text')
      await clickCanvasAt(collab.page1, EMPTY_CANVAS_POINT)
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(3)

      const page2DraggedText = getCanvasNodesByType(collab.page2, 'text').filter({
        hasText: 'Dragged shared text',
      })
      const beforeMove = await getCanvasNodeBoundingBox(page2DraggedText)

      await selectCanvasTool(collab.page1, 'Pointer')
      const page1DraggedText = getCanvasNodesByType(collab.page1, 'text').filter({
        hasText: 'Dragged shared text',
      })
      await clickCanvasNode(collab.page1, page1DraggedText)
      await dragCanvasNode(
        collab.page1,
        page1DraggedText,
        { x: 140, y: 80 },
        { positionRatio: { xRatio: 0.5, yRatio: 0.5 } },
      )

      await expect
        .poll(
          async () => {
            const box = await getCanvasNodeBoundingBox(page2DraggedText)
            const deltaX = Math.round(box.x - beforeMove.x)
            const deltaY = Math.round(box.y - beforeMove.y)
            return deltaX > 80 && deltaY > 40
          },
          { timeout: SHARED_TEXT_TIMEOUT_MS },
        )
        .toBe(true)

      const beforeResize = await getCanvasNodeBoundingBox(page2DraggedText)
      await resizeCanvasNode(collab.page1, page1DraggedText, 'bottom-right', { x: 80, y: 60 })

      await expect
        .poll(
          async () => {
            const box = await getCanvasNodeBoundingBox(page2DraggedText)
            const deltaWidth = Math.round(box.width - beforeResize.width)
            const deltaHeight = Math.round(box.height - beforeResize.height)
            return deltaWidth > 40 && deltaHeight > 20
          },
          { timeout: SHARED_TEXT_TIMEOUT_MS },
        )
        .toBe(true)

      await selectCanvasTool(collab.page1, 'Draw')
      await dragOnCanvas(collab.page1, { x: 470, y: 110 }, { x: 560, y: 200 })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'stroke').count()).toBe(1)
    } finally {
      await closeCollabContexts(collab)
    }
  })

  test('keeps marquee and lasso pending preview local to the active tab', async ({ browser }) => {
    const collab = await createCollabContexts(browser)

    try {
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)

      await selectCanvasTool(collab.page1, 'Pointer')
      await clickCanvasAt(collab.page1, { x: 720, y: 520 })
      await startCanvasPointerGesture(collab.page1, { x: 80, y: 60 })
      await moveCanvasPointer(collab.page1, { x: 450, y: 230 })

      await expect(getCanvasMarqueeOverlay(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page2)).toHaveCount(0)
      await expect(getCanvasPendingPreviewActiveNodes(collab.page2)).toHaveCount(0)

      await endCanvasPointerGesture(collab.page1)
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toHaveCount(0)

      await selectCanvasTool(collab.page1, 'Lasso select')
      await startCanvasPointerGesture(collab.page1, { x: 245, y: 240 })
      await moveCanvasPointer(collab.page1, { x: 470, y: 240 })
      await moveCanvasPointer(collab.page1, { x: 470, y: 430 })
      await moveCanvasPointer(collab.page1, { x: 235, y: 430 })

      await expect(getCanvasLassoOverlay(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page2)).toHaveCount(0)
      await expect(getCanvasPendingPreviewActiveNodes(collab.page2)).toHaveCount(0)

      await moveCanvasPointer(collab.page1, { x: 220, y: 250 })
      await endCanvasPointerGesture(collab.page1)
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toHaveCount(0)
      await expect(getCanvasPendingSelectionStatus(collab.page2)).toHaveCount(0)
    } finally {
      await closeCollabContexts(collab)
    }
  })
})

async function openCollabCanvas(page: Page) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, canvasName)
}

async function createCollabContexts(browser: Browser) {
  const context1 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })
  let context2: BrowserContext | null = null

  try {
    context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    return {
      context1,
      context2,
      page1: await context1.newPage(),
      page2: await context2.newPage(),
    }
  } catch (error) {
    if (context2) {
      await context2.close()
    }
    await context1.close()
    throw error
  }
}

async function closeCollabContexts({
  context1,
  context2,
  page1,
  page2,
}: {
  context1: BrowserContext
  context2: BrowserContext
  page1: Page
  page2: Page
}) {
  await page1.close()
  await page2.close()
  await context1.close()
  await context2.close()
}
