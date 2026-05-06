import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  clearCanvasRuntimeMetrics,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragCanvasNode,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodesByType,
  getCanvasPane,
  getCanvasRuntimeMetrics,
  getCanvasRuntimeSnapshot,
  openCanvas,
  seedCanvasStrokeNodesViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  selectFirstCanvasNodesViaRuntime,
  waitForCanvasRuntime,
  wheelCanvasPane,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CnvPerf')
const canvasName = DEFAULT_CANVAS_NAME
// Selected-state background applied by updateSelectedNodeSurface in the opt-in canvas runtime.
const EXPECTED_SELECTED_STATE_BG = 'rgb(232, 242, 255)'

test.use({ storageState: AUTH_STORAGE_PATH })

test.describe.serial('canvas performance smoke workflows', () => {
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

  test('keeps direct multi-select updates and drags responsive on a medium canvas', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 80,
      columns: 10,
      spacingX: 160,
      spacingY: 100,
      start: { x: 80, y: 80 },
    })

    await selectFirstCanvasNodesViaRuntime(page, 40)
    const startedAt = Date.now()
    await page.evaluate(() => {
      const runtime = window.__WA_CANVAS_PERF_RUNTIME__
      if (!runtime) {
        throw new Error('Missing __WA_CANVAS_PERF_RUNTIME__ for updateSelectedNodeSurface')
      }
      runtime.updateSelectedNodeSurface()
    })
    const updateDurationMs = Date.now() - startedAt
    await expect
      .poll(() =>
        getCanvasNodeById(page, 'perf-node-0').evaluate(
          (node) => getComputedStyle(node.querySelector('[role="group"]')!).backgroundColor,
        ),
      )
      .toBe(EXPECTED_SELECTED_STATE_BG)
    expect(updateDurationMs).toBeLessThan(5_000)

    await selectCanvasTool(page, 'Pointer')
    await dragCanvasNode(page, getCanvasNodeById(page, 'perf-node-0'), { x: 30, y: 20 })
    await expect(getCanvasNodeById(page, 'perf-node-0')).toBeVisible()
  })

  test('keeps stroke detail rendering stable during viewport motion', async ({ page }) => {
    await seedCanvasStrokeNodesViaRuntime(page, {
      count: 20,
      columns: 5,
      spacingX: 180,
      spacingY: 120,
      start: { x: 120, y: 160 },
      pointsPerStroke: 40,
    })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(20)

    const paneBox = await getCanvasPane(page).boundingBox()
    if (!paneBox) throw new Error('Canvas pane is not visible')

    await page.mouse.move(paneBox.x + paneBox.width / 2, paneBox.y + paneBox.height / 2)
    await page.mouse.wheel(0, -120)

    await expect
      .poll(() =>
        page.evaluate(() => {
          const detailPath = document.querySelector('.canvas-stroke-detail-path')
          const viewport = document.querySelector('.canvas-scene__viewport')
          return {
            hasDetailPath: detailPath !== null,
            cameraState: viewport?.getAttribute('data-camera-state') ?? null,
          }
        }),
      )
      .toEqual({ hasDetailPath: true, cameraState: 'moving' })
  })

  test('runs a CI-safe mixed-scene pan zoom and drag smoke without metric spikes', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 50,
      columns: 10,
      spacingX: 150,
      spacingY: 95,
      start: { x: 80, y: 80 },
    })
    await seedCanvasStrokeNodesViaRuntime(page, {
      count: 20,
      columns: 5,
      spacingX: 190,
      spacingY: 130,
      start: { x: 120, y: 700 },
      pointsPerStroke: 30,
    })
    await clearCanvasRuntimeMetrics(page)

    const startedAt = Date.now()
    await wheelCanvasPane(page, { x: 120, y: 80 })
    await wheelCanvasPane(page, { x: 0, y: -120 }, { controlOrMeta: true })
    await selectCanvasTool(page, 'Pointer')
    await dragCanvasNode(page, getCanvasNodeById(page, 'perf-node-0'), { x: 24, y: 18 })
    expect(Date.now() - startedAt).toBeLessThan(6_000)

    const metrics = await getCanvasRuntimeMetrics(page)
    const slowMetrics = metrics.filter((metric) => metric.durationMs > 250)
    expect(slowMetrics).toEqual([])
  })

  test('keeps selection, pan, zoom, and drag responsive on a large seeded canvas', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 240,
      columns: 24,
      spacingX: 170,
      spacingY: 110,
      start: { x: 80, y: 80 },
    })
    await seedCanvasStrokeNodesViaRuntime(page, {
      count: 80,
      columns: 16,
      spacingX: 180,
      spacingY: 120,
      start: { x: 80, y: 1400 },
      pointsPerStroke: 16,
    })

    const snapshot = await getCanvasRuntimeSnapshot(page)
    expect(snapshot.nodes).toHaveLength(320)

    const startedAt = Date.now()
    await wheelCanvasPane(page, { x: 160, y: 100 })
    await wheelCanvasPane(page, { x: 0, y: -120 }, { controlOrMeta: true })
    await selectCanvasTool(page, 'Pointer')
    await dragCanvasNode(page, getCanvasNodeById(page, 'perf-node-0'), { x: 20, y: 16 })
    expect(Date.now() - startedAt).toBeLessThan(8_000)
    await expect(getCanvasNodeById(page, 'perf-node-0')).toBeVisible()
  })
})
