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
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
const SHARED_TEXT_TIMEOUT_MS = 15_000

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
      console.debug('Failed to delete canvas collaboration campaign during teardown', {
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
      await collab.page1.getByLabel('Text node content').fill('Shared text')
      await collab.page1.getByLabel('Text node content').press('Enter')

      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(1)
      await expect(collab.page2.getByText('Shared text', { exact: true })).toBeVisible({
        timeout: SHARED_TEXT_TIMEOUT_MS,
      })

      await selectCanvasTool(collab.page1, 'Post-it')
      await clickCanvasAt(collab.page1, { x: 320, y: 120 })
      await collab.page1.getByLabel('Sticky note text').fill('Shared sticky')
      await collab.page1.getByLabel('Sticky note text').press(`${mod}+Enter`)
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'sticky').count()).toBe(1)

      await selectCanvasTool(collab.page1, 'Rectangle')
      await dragOnCanvas(collab.page1, { x: 260, y: 260 }, { x: 380, y: 360 })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'rectangle').count()).toBe(1)

      const page2Rectangle = getCanvasNodesByType(collab.page2, 'rectangle').first()
      const beforeMove = await getCanvasNodeBoundingBox(page2Rectangle)

      await selectCanvasTool(collab.page1, 'Pointer')
      const page1Rectangle = getCanvasNodesByType(collab.page1, 'rectangle').first()
      await clickCanvasNode(collab.page1, page1Rectangle)
      await dragCanvasNode(collab.page1, page1Rectangle, { x: 140, y: 80 })

      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          const deltaX = Math.round(box.x - beforeMove.x)
          const deltaY = Math.round(box.y - beforeMove.y)
          return deltaX > 80 && deltaY > 40
        })
        .toBe(true)

      const beforeResize = await getCanvasNodeBoundingBox(page2Rectangle)
      await resizeCanvasNode(collab.page1, page1Rectangle, 'bottom-right', { x: 80, y: 60 })

      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          const deltaWidth = Math.round(box.width - beforeResize.width)
          const deltaHeight = Math.round(box.height - beforeResize.height)
          return deltaWidth > 40 && deltaHeight > 20
        })
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
  const context2 = await browser.newContext({
    storageState: AUTH_STORAGE_PATH,
  })

  return {
    context1,
    context2,
    page1: await context1.newPage(),
    page2: await context2.newPage(),
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
