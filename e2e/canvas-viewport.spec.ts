import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragCanvasNode,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasPane,
  getCanvasRuntimeNodePosition,
  getCanvasSurface,
  getCanvasViewport,
  getCanvasViewportViaRuntime,
  getViewportControls,
  openCanvas,
  seedCanvasCoordinateProbeNodeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasViewportViaRuntime,
  waitForCanvasRuntime,
  wheelCanvasPane,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CnvViewport')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas viewport interactions', () => {
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
    await openViewportCanvas(page)
    await clearCanvasViaRuntime(page)
  })

  test('keeps drag coordinates correct after pan and zoom', async ({ page }) => {
    await seedCanvasCoordinateProbeNodeViaRuntime(page, 'perf-embed-0', { x: 120, y: 120 })
    await setCanvasViewportViaRuntime(page, { x: 260, y: 120, zoom: 2 })
    const node = getCanvasNodeById(page, 'perf-embed-0')
    await expect(node).toBeVisible({ timeout: 10_000 })
    const before = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')

    await selectCanvasTool(page, 'Pointer')
    await dragCanvasNode(page, node, { x: 80, y: 40 })

    await expect
      .poll(async () => {
        const after = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')
        return {
          x: Math.round(after.x - before.x),
          y: Math.round(after.y - before.y),
        }
      })
      .toEqual({ x: 40, y: 20 })
  })

  for (const viewport of [
    { x: 160, y: -80, zoom: 0.5 },
    { x: -120, y: 90, zoom: 1 },
    { x: 260, y: 120, zoom: 2 },
  ] as const) {
    test(`keeps drag model deltas correct at zoom ${viewport.zoom}`, async ({ page }) => {
      await seedCanvasCoordinateProbeNodeViaRuntime(page, 'perf-embed-0', { x: 160, y: 160 })
      await setCanvasViewportViaRuntime(page, viewport)
      const node = getCanvasNodeById(page, 'perf-embed-0')
      const before = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')

      await selectCanvasTool(page, 'Pointer')
      await dragCanvasNode(
        page,
        node,
        { x: 60, y: 40 },
        { positionRatio: { xRatio: 0.1, yRatio: 0.1 } },
      )

      const expectedX = 60 / viewport.zoom
      const expectedY = 40 / viewport.zoom
      const toleranceX = Math.max(4, expectedX * 0.35)
      const toleranceY = Math.max(4, expectedY * 0.35)
      await expect
        .poll(async () => {
          const after = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')
          return Math.round(after.x - before.x)
        })
        .toBeGreaterThanOrEqual(expectedX - toleranceX)
      await expect
        .poll(async () => {
          const after = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')
          return Math.round(after.x - before.x)
        })
        .toBeLessThanOrEqual(expectedX + toleranceX)
      await expect
        .poll(async () => {
          const after = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')
          return Math.round(after.y - before.y)
        })
        .toBeGreaterThanOrEqual(expectedY - toleranceY)
      await expect
        .poll(async () => {
          const after = await getCanvasRuntimeNodePosition(page, 'perf-embed-0')
          return Math.round(after.y - before.y)
        })
        .toBeLessThanOrEqual(expectedY + toleranceY)
    })
  }

  test('persists committed viewport changes across reloads', async ({ page }) => {
    await clearPersistedCanvasViewports(page)
    await seedCanvasTextNodesViaRuntime(page, {
      count: 6,
      columns: 3,
      start: { x: 120, y: 120 },
    })
    const controls = getViewportControls(page)

    await controls.zoomIn.click()
    await controls.zoomIn.click()
    await expect.poll(() => getCanvasViewportViaRuntime(page)).toMatchObject({ zoom: 1.44 })
    await expect.poll(() => hasPersistedViewportZoom(page, 1.44)).toBe(true)

    await page.reload()
    await expect(getCanvasSurface(page)).toBeVisible({ timeout: 10_000 })
    await waitForCanvasRuntime(page)

    await expect.poll(() => getCanvasViewportViaRuntime(page)).toMatchObject({ zoom: 1.44 })
  })

  test('routes hand-tool drags and middle-button drags through viewport pan', async ({ page }) => {
    await seedCanvasTextNodesViaRuntime(page, { count: 1, start: { x: 120, y: 120 } })
    await selectCanvasTool(page, 'Panning')
    const paneBox = await getCanvasPane(page).boundingBox()
    if (!paneBox) throw new Error('Canvas pane is not visible')

    await page.mouse.move(paneBox.x + 300, paneBox.y + 260)
    await page.mouse.down()
    await page.mouse.move(paneBox.x + 360, paneBox.y + 300, { steps: 10 })
    await page.mouse.up()

    await expect
      .poll(async () => {
        const viewport = await getCanvasViewportViaRuntime(page)
        return viewport.x > 30 && viewport.y > 20
      })
      .toBe(true)

    const afterHandPan = await getCanvasViewportViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')
    await page.mouse.move(paneBox.x + 300, paneBox.y + 260)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(paneBox.x + 340, paneBox.y + 260, { steps: 8 })
    await page.mouse.up({ button: 'middle' })

    await expect
      .poll(async () => {
        const viewport = await getCanvasViewportViaRuntime(page)
        return viewport.x > afterHandPan.x + 20
      })
      .toBe(true)
  })

  test('routes wheel pan, control-wheel zoom, and fit view through the viewport controller', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 4,
      columns: 2,
      spacingX: 260,
      spacingY: 180,
      start: { x: 120, y: 120 },
    })
    const beforeWheel = await getCanvasViewportViaRuntime(page)

    await wheelCanvasPane(page, { x: 40, y: 120 })
    await expect
      .poll(async () => {
        const afterWheel = await getCanvasViewportViaRuntime(page)
        return afterWheel.x !== beforeWheel.x || afterWheel.y !== beforeWheel.y
      })
      .toBe(true)

    const beforeZoom = await getCanvasViewportViaRuntime(page)
    await wheelCanvasPane(page, { x: 0, y: -180 }, { controlOrMeta: true })
    await expect
      .poll(async () => {
        const afterZoom = await getCanvasViewportViaRuntime(page)
        return afterZoom.zoom > beforeZoom.zoom
      })
      .toBe(true)

    await getViewportControls(page).fitZoom.click()
    await expect
      .poll(async () => {
        const fitted = await getCanvasViewportViaRuntime(page)
        return (
          fitted.zoom !== beforeZoom.zoom && Number.isFinite(fitted.x) && Number.isFinite(fitted.y)
        )
      })
      .toBe(true)
  })

  test('keeps the viewport element transformed while screen-space chrome remains outside it', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 2,
      columns: 2,
      spacingX: 220,
      start: { x: 120, y: 120 },
    })
    await setCanvasViewportViaRuntime(page, { x: 80, y: 60, zoom: 1.5 })

    await expect(getCanvasViewport(page)).toHaveCSS(
      'transform',
      /matrix\(1\.5, 0, 0, 1\.5, 80, 60\)/,
    )
    const zoomInButton = await getViewportControls(page).zoomIn.elementHandle()
    if (!zoomInButton) throw new Error('Viewport zoom-in control is not visible')
    const viewportContainsChrome = await getCanvasViewport(page).evaluate(
      (viewport, button) => viewport.contains(button),
      zoomInButton,
    )
    expect(viewportContainsChrome).toBe(false)
  })
})

async function openViewportCanvas(page: Parameters<typeof openCanvas>[0]) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, canvasName)
  await waitForCanvasRuntime(page)
}

async function hasPersistedViewportZoom(page: Parameters<typeof openCanvas>[0], zoom: number) {
  return page.evaluate((expectedZoom) => {
    for (const [key, value] of Object.entries(localStorage)) {
      if (!key.startsWith('canvas-viewport-')) {
        continue
      }

      try {
        const viewport = JSON.parse(value) as { zoom?: unknown }
        if (viewport.zoom === expectedZoom) {
          return true
        }
      } catch {
        continue
      }
    }

    return false
  }, zoom)
}

async function clearPersistedCanvasViewports(page: Parameters<typeof openCanvas>[0]) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('canvas-viewport-')) {
        localStorage.removeItem(key)
      }
    }
  })
}
