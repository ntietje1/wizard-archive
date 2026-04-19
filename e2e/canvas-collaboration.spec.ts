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
  getCanvasPendingSelectionStatus,
  moveCanvasPointer,
  openCanvas,
  resizeCanvasNode,
  selectCanvasTool,
  startCanvasPointerGesture,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('Cnv Collab')
const canvasName = DEFAULT_CANVAS_NAME
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

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
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('syncs node creation, stroke drawing, dragging, and resizing across tabs', async ({
    browser,
  }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      await openCollabCanvas(page1)
      await openCollabCanvas(page2)

      await selectCanvasTool(page1, 'Text')
      await clickCanvasAt(page1, { x: 120, y: 120 })
      await page1.getByLabel('Text node content').fill('Shared text')
      await page1.getByLabel('Text node content').press('Enter')

      await expect.poll(() => getCanvasNodesByType(page2, 'text').count()).toBe(1)
      await expect(page2.getByText('Shared text', { exact: true })).toBeVisible({
        timeout: 15000,
      })

      await selectCanvasTool(page1, 'Post-it')
      await clickCanvasAt(page1, { x: 320, y: 120 })
      await page1.getByLabel('Sticky note text').fill('Shared sticky')
      await page1.getByLabel('Sticky note text').press(`${mod}+Enter`)
      await expect.poll(() => getCanvasNodesByType(page2, 'sticky').count()).toBe(1)

      await selectCanvasTool(page1, 'Rectangle')
      await dragOnCanvas(page1, { x: 260, y: 260 }, { x: 380, y: 360 })
      await expect.poll(() => getCanvasNodesByType(page2, 'rectangle').count()).toBe(1)

      const page2Rectangle = getCanvasNodesByType(page2, 'rectangle').first()
      const beforeMove = await getCanvasNodeBoundingBox(page2Rectangle)

      await selectCanvasTool(page1, 'Pointer')
      const page1Rectangle = getCanvasNodesByType(page1, 'rectangle').first()
      await clickCanvasNode(page1, page1Rectangle)
      await dragCanvasNode(page1, page1Rectangle, { x: 140, y: 80 })

      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          return Math.round(box.x - beforeMove.x)
        })
        .toBeGreaterThan(80)
      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          return Math.round(box.y - beforeMove.y)
        })
        .toBeGreaterThan(40)

      const beforeResize = await getCanvasNodeBoundingBox(page2Rectangle)
      await resizeCanvasNode(page1, page1Rectangle, 'bottom-right', { x: 80, y: 60 })

      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          return Math.round(box.width - beforeResize.width)
        })
        .toBeGreaterThan(40)
      await expect
        .poll(async () => {
          const box = await getCanvasNodeBoundingBox(page2Rectangle)
          return Math.round(box.height - beforeResize.height)
        })
        .toBeGreaterThan(20)

      await selectCanvasTool(page1, 'Draw')
      await dragOnCanvas(page1, { x: 470, y: 110 }, { x: 560, y: 200 })
      await expect.poll(() => getCanvasNodesByType(page2, 'stroke').count()).toBe(1)
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })

  test('keeps marquee and lasso pending preview local to the active tab', async ({ browser }) => {
    const context1 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const context2 = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    try {
      await openCollabCanvas(page1)
      await openCollabCanvas(page2)

      await selectCanvasTool(page1, 'Pointer')
      await clickCanvasAt(page1, { x: 720, y: 520 })
      await startCanvasPointerGesture(page1, { x: 80, y: 60 })
      await moveCanvasPointer(page1, { x: 450, y: 230 })

      await expect(getCanvasMarqueeOverlay(page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(page2)).toHaveCount(0)
      await expect(page2.locator('[data-node-pending-preview-active="true"]')).toHaveCount(0)

      await endCanvasPointerGesture(page1)
      await expect(getCanvasPendingSelectionStatus(page1)).toHaveCount(0)

      await selectCanvasTool(page1, 'Lasso select')
      await startCanvasPointerGesture(page1, { x: 245, y: 240 })
      await moveCanvasPointer(page1, { x: 470, y: 240 })
      await moveCanvasPointer(page1, { x: 470, y: 430 })
      await moveCanvasPointer(page1, { x: 235, y: 430 })

      await expect(getCanvasLassoOverlay(page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(page2)).toHaveCount(0)
      await expect(page2.locator('[data-node-pending-preview-active="true"]')).toHaveCount(0)

      await moveCanvasPointer(page1, { x: 220, y: 250 })
      await endCanvasPointerGesture(page1)
      await expect(getCanvasPendingSelectionStatus(page1)).toHaveCount(0)
      await expect(getCanvasPendingSelectionStatus(page2)).toHaveCount(0)
    } finally {
      await page1.close()
      await page2.close()
      await context1.close()
      await context2.close()
    }
  })
})

async function openCollabCanvas(page: Parameters<typeof createCanvas>[0]) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, canvasName)
}
