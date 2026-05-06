import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasEdges,
  getCanvasNodesByType,
  getCanvasPane,
  getCanvasRemoteCursor,
  getCanvasRemoteDrawPreview,
  getCanvasRemoteLassoPreview,
  getCanvasRemoteSelectionPreview,
  getCanvasRuntimeNodePosition,
  moveCanvasPointer,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  setCanvasSelectionViaRuntime,
  selectFirstCanvasNodesViaRuntime,
  selectCanvasTool,
  startCanvasPointerGesture,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Browser, BrowserContext, Page } from '@playwright/test'

const campaignName = testName('CnvCollabA')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas collaboration edge cases', () => {
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

  test('syncs document changes while selections remain local to each tab', async ({ browser }) => {
    const collab = await createCollabContexts(browser)

    try {
      await enableCanvasRuntime(collab.page1)
      await enableCanvasRuntime(collab.page2)
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)
      await clearCanvasViaRuntime(collab.page1)
      await seedCanvasTextNodesViaRuntime(collab.page1, {
        count: 3,
        columns: 3,
        spacingX: 180,
        start: { x: 120, y: 120 },
      })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(3)

      await selectFirstCanvasNodesViaRuntime(collab.page1, 2)
      await expect(getCanvasNodeById(collab.page1, 'perf-node-0')).toHaveAttribute(
        'data-node-selected',
        'true',
      )
      await expect(getCanvasNodeById(collab.page2, 'perf-node-0')).not.toHaveAttribute(
        'data-node-selected',
        'true',
      )

      const before = await getCanvasRuntimeNodePosition(collab.page2, 'perf-node-0')
      await collab.page1.evaluate(() => {
        const runtime = window.__WA_CANVAS_PERF_RUNTIME__
        if (!runtime) {
          throw new Error('Missing __WA_CANVAS_PERF_RUNTIME__ for collaboration drag profile')
        }
        runtime.profileSelectedNodeDrag({
          delta: { x: 60, y: 30 },
          steps: 6,
        })
      })

      await expect
        .poll(
          async () => {
            const after = await getCanvasRuntimeNodePosition(collab.page2, 'perf-node-0')
            return after.x > before.x + 30 && after.y > before.y + 10
          },
          { timeout: 15_000 },
        )
        .toBe(true)
    } finally {
      await closeCollabContexts(collab)
    }
  })

  test('converges concurrent node, edge, deletion, property, and reload changes', async ({
    browser,
  }) => {
    const collab = await createCollabContexts(browser)

    try {
      await enableCanvasRuntime(collab.page1)
      await enableCanvasRuntime(collab.page2)
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)
      await clearCanvasViaRuntime(collab.page1)
      await seedCanvasTextNodesViaRuntime(collab.page1, {
        count: 2,
        columns: 2,
        spacingX: 220,
        start: { x: 120, y: 120 },
      })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(2)

      await setCanvasSelectionViaRuntime(collab.page1, { nodeIds: ['perf-node-0'] })
      await setCanvasSelectionViaRuntime(collab.page2, { nodeIds: ['perf-node-0'] })
      await Promise.all([
        collab.page1.evaluate(() => {
          const runtime = window.__WA_CANVAS_PERF_RUNTIME__
          if (!runtime) {
            throw new Error('Missing __WA_CANVAS_PERF_RUNTIME__ for collaboration drag profile')
          }
          runtime.profileSelectedNodeDrag({
            delta: { x: 40, y: 0 },
            steps: 4,
          })
        }),
        collab.page2.evaluate(() => {
          const runtime = window.__WA_CANVAS_PERF_RUNTIME__
          if (!runtime) {
            throw new Error('Missing __WA_CANVAS_PERF_RUNTIME__ for collaboration drag profile')
          }
          runtime.profileSelectedNodeDrag({
            delta: { x: 0, y: 40 },
            steps: 4,
          })
        }),
      ])
      await expect
        .poll(async () => {
          const [page1Position, page2Position] = await Promise.all([
            getCanvasRuntimeNodePosition(collab.page1, 'perf-node-0'),
            getCanvasRuntimeNodePosition(collab.page2, 'perf-node-0'),
          ])
          return (
            Math.abs(page1Position.x - page2Position.x) <= 1 &&
            Math.abs(page1Position.y - page2Position.y) <= 1
          )
        })
        .toBe(true)

      await seedCanvasEdgeViaRuntime(collab.page1, {
        id: 'collab-edge',
        source: 'perf-node-0',
        target: 'perf-node-1',
        type: 'straight',
        style: { stroke: '#ef4444', strokeWidth: 6, opacity: 100 },
      })
      await expect.poll(() => getCanvasEdges(collab.page2).count()).toBe(1)

      await setCanvasSelectionViaRuntime(collab.page2, { nodeIds: ['perf-node-1'] })
      await setCanvasSelectionViaRuntime(collab.page1, { nodeIds: ['perf-node-1'] })
      await collab.page1.keyboard.press('Delete')
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(1)
      await expect.poll(() => getCanvasEdges(collab.page2).count()).toBe(0)

      await collab.page2.reload()
      await waitForCanvasRuntime(collab.page2)
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(1)
      await expect(getCanvasNodeById(collab.page2, 'perf-node-0')).toBeVisible()
    } finally {
      await closeCollabContexts(collab)
    }
  })

  test.fixme('shows remote cursor and in-progress selection, lasso, and draw previews', async ({
    browser,
  }) => {
    const collab = await createCollabContexts(browser)

    try {
      await enableCanvasRuntime(collab.page1)
      await enableCanvasRuntime(collab.page2)
      await openCollabCanvas(collab.page1)
      await openCollabCanvas(collab.page2)
      await clearCanvasViaRuntime(collab.page1)
      await seedCanvasTextNodesViaRuntime(collab.page1, {
        count: 1,
        start: { x: 220, y: 180 },
      })
      await expect.poll(() => getCanvasNodesByType(collab.page2, 'text').count()).toBe(1)

      const paneBox = await getCanvasPane(collab.page2).boundingBox()
      if (!paneBox) throw new Error('Canvas pane is not visible')
      await collab.page2.mouse.move(paneBox.x + 240, paneBox.y + 180)
      await expect(getCanvasRemoteCursor(collab.page1)).toBeVisible({ timeout: 10_000 })

      await selectCanvasTool(collab.page2, 'Pointer')
      await startCanvasPointerGesture(collab.page2, { x: 120, y: 120 })
      await moveCanvasPointer(collab.page2, { x: 420, y: 300 })
      await expect(getCanvasRemoteSelectionPreview(collab.page1)).toBeVisible({ timeout: 10_000 })
      await collab.page2.mouse.up()

      await selectCanvasTool(collab.page2, 'Lasso select')
      await startCanvasPointerGesture(collab.page2, { x: 120, y: 120 })
      await moveCanvasPointer(collab.page2, { x: 240, y: 160 })
      await moveCanvasPointer(collab.page2, { x: 220, y: 280 })
      await expect(getCanvasRemoteLassoPreview(collab.page1)).toBeVisible({ timeout: 10_000 })
      await collab.page2.mouse.up()

      await selectCanvasTool(collab.page2, 'Draw')
      await startCanvasPointerGesture(collab.page2, { x: 260, y: 260 })
      await moveCanvasPointer(collab.page2, { x: 340, y: 300 })
      await expect(getCanvasRemoteDrawPreview(collab.page1)).toBeVisible({ timeout: 10_000 })
      await collab.page2.mouse.up()
    } finally {
      await closeCollabContexts(collab)
    }
  })
})

async function openCollabCanvas(page: Page) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, canvasName)
  await waitForCanvasRuntime(page)
}

async function createCollabContexts(browser: Browser) {
  const context1 = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
  let context2: BrowserContext | null = null
  let page1: Page | null = null
  let page2: Page | null = null

  try {
    context2 = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    page1 = await context1.newPage()
    page2 = await context2.newPage()
    return {
      context1,
      context2,
      page1,
      page2,
    }
  } catch (error) {
    await closeAllSettled([page2, page1, context2, context1])
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
  await closeAllSettled([page1, page2, context1, context2])
}

async function closeAllSettled(resources: Array<Page | BrowserContext | null>): Promise<void> {
  const results = await Promise.allSettled(
    resources.map((resource) => (resource ? resource.close() : Promise.resolve())),
  )
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('Failed to close canvas collaboration test resource', result.reason)
    }
  }
}
