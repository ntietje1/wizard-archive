import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragOnCanvas,
  enableCanvasRuntime,
  endCanvasPointerGesture,
  getCanvasMarqueeOverlay,
  getCanvasNodeById,
  getCanvasNodeBoundingBox,
  getCanvasNodesByType,
  getCanvasPendingPreviewActiveNodes,
  getCanvasPendingSelectionStatus,
  getCanvasRuntimeNodePosition,
  moveCanvasPointer,
  openCanvas,
  resizeCanvasNode,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasSelectionViaRuntime,
  startCanvasPointerGesture,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const campaignName = testName('Cnv Collab')
const canvasName = DEFAULT_CANVAS_NAME
const SHARED_TEXT_TIMEOUT_MS = 15_000

test.describe.serial('canvas collaboration', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
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
    await page.goto('/campaigns', { waitUntil: 'commit' })
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

  test('syncs text nodes, stroke drawing, dragging, and resizing across tabs', async ({
    browser,
  }) => {
    const collab = await createCollabContexts(browser)

    try {
      await enableCanvasRuntime(collab.page1)
      await enableCanvasRuntime(collab.page2)
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)
      await waitForCanvasRuntime(collab.page1)
      await waitForCanvasRuntime(collab.page2)
      await clearCanvasViaRuntime(collab.page1)
      await seedCanvasTextNodesViaRuntime(collab.page1, {
        count: 3,
        columns: 3,
        idPrefix: 'collab-node',
        labelPrefix: 'Shared text',
        spacingX: 220,
        start: { x: 120, y: 120 },
      })

      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(3)
      await expect(collab.page2.getByText('Shared text 0', { exact: true })).toBeVisible({
        timeout: SHARED_TEXT_TIMEOUT_MS,
      })

      await selectCanvasTool(collab.page1, 'Pointer')
      const draggedNodeId = 'collab-node-2'
      const page1DraggedText = getCanvasNodeById(collab.page1, draggedNodeId)
      const page2DraggedText = getCanvasNodeById(collab.page2, draggedNodeId)
      await setCanvasSelectionViaRuntime(collab.page1, { nodeIds: [draggedNodeId] })
      const page1BeforeMove = await getCanvasRuntimeNodePosition(collab.page1, draggedNodeId)
      const page2BeforeMove = await getCanvasRuntimeNodePosition(collab.page2, draggedNodeId)
      await collab.page1.evaluate(() => {
        const runtime = window.__WA_CANVAS_PERF_RUNTIME__
        if (!runtime) {
          throw new Error('Missing __WA_CANVAS_PERF_RUNTIME__ for collaboration drag')
        }
        runtime.profileSelectedNodeDrag({
          delta: { x: 140, y: 80 },
          steps: 12,
        })
      })
      await expect
        .poll(
          async () => {
            const localPosition = await getCanvasRuntimeNodePosition(collab.page1, draggedNodeId)
            const deltaX = Math.round(localPosition.x - page1BeforeMove.x)
            const deltaY = Math.round(localPosition.y - page1BeforeMove.y)
            return deltaX > 80 && deltaY > 40
          },
          { timeout: SHARED_TEXT_TIMEOUT_MS },
        )
        .toBe(true)

      await expect
        .poll(
          async () => {
            const position = await getCanvasRuntimeNodePosition(collab.page2, draggedNodeId)
            const deltaX = Math.round(position.x - page2BeforeMove.x)
            const deltaY = Math.round(position.y - page2BeforeMove.y)
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

  test('keeps marquee pending preview local to the active tab', async ({ browser }) => {
    const collab = await createCollabContexts(browser)

    try {
      await enableCanvasRuntime(collab.page1)
      await enableCanvasRuntime(collab.page2)
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)
      await waitForCanvasRuntime(collab.page1)
      await waitForCanvasRuntime(collab.page2)
      await clearCanvasViaRuntime(collab.page1)
      await seedCanvasTextNodesViaRuntime(collab.page1, {
        count: 2,
        columns: 2,
        spacingX: 360,
        start: { x: 160, y: 100 },
      })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(2)

      await selectCanvasTool(collab.page1, 'Pointer')
      await clickCanvasAt(collab.page1, { x: 720, y: 520 })
      await startCanvasPointerGesture(collab.page1, { x: 20, y: 320 })
      await moveCanvasPointer(collab.page1, { x: 850, y: 20 })

      await expect(getCanvasMarqueeOverlay(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toBeVisible()
      await expect(getCanvasPendingSelectionStatus(collab.page2)).toHaveCount(0)
      await expect(getCanvasPendingPreviewActiveNodes(collab.page2)).toHaveCount(0)

      await endCanvasPointerGesture(collab.page1)
      await expect(getCanvasPendingSelectionStatus(collab.page1)).toHaveCount(0)
      await expect(getCanvasPendingSelectionStatus(collab.page2)).toHaveCount(0)
    } finally {
      await closeCollabContexts(collab)
    }
  })
})

async function openCollabCanvas(page: Page) {
  await page.goto('/campaigns', { waitUntil: 'commit' })
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
