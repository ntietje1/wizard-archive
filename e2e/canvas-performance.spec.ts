import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  createCanvas,
  dragCanvasNode,
  dragOnCanvas,
  getCanvasNodeById,
  getCanvasPane,
  getViewportControls,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const ARTIFACT_DIR = path.resolve('output/playwright')
const ARTIFACT_PREFIX = process.env.CANVAS_PERF_ARTIFACT_PREFIX ?? 'canvas-performance-baseline'
const NODE_COUNT = readCanvasPerfCount('CANVAS_PERF_NODE_COUNT', 250)
const STROKE_NODE_COUNT = readCanvasPerfCount('CANVAS_PERF_STROKE_NODE_COUNT', 50)
const SELECTED_COUNTS = [1, 25, 100, 250].filter((count) => count <= NODE_COUNT)
const campaignName = testName('Perf')
const canvasName = 'Untitled Canvas'

interface CanvasPerformanceMetric {
  name: string
  durationMs: number
  timestampMs: number
  details?: Record<string, unknown>
}

interface InteractionSummary {
  wallMs: number
  metrics: Record<
    string,
    {
      count: number
      totalMs: number
      avgMs: number
      maxMs: number
      p95Ms: number
    }
  >
}

test.describe.serial('canvas performance probe', () => {
  test.skip(process.env.CANVAS_PERF_PROBE !== '1', 'Set CANVAS_PERF_PROBE=1 to run this probe')
  test.use({ storageState: AUTH_STORAGE_PATH })
  test.setTimeout(240_000)

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch (error) {
      console.debug('Failed to delete canvas performance probe campaign during teardown', {
        campaignName,
        error,
      })
    }
    await page.close()
    await context.close()
  })

  test('profiles heavy canvas interactions', async ({ page, context }) => {
    await mkdir(ARTIFACT_DIR, { recursive: true })
    await page.addInitScript(() => {
      window.__WA_CANVAS_PERF__ = { enabled: true, entries: [] }
    })

    await context.tracing.start({ screenshots: true, snapshots: true })
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)
    await waitForCanvasPerformanceRuntime(page)

    await page.evaluate((count) => {
      const runtime = window.__WA_CANVAS_PERF_RUNTIME__
      if (!runtime) throw new Error('Missing canvas performance runtime')
      runtime.clearCanvas()
      runtime.seedTextNodes({
        count,
        columns: 25,
        spacingX: 180,
        spacingY: 120,
        start: { x: 120, y: 120 },
      })
    }, NODE_COUNT)

    await waitForRuntimeNodeCount(page, NODE_COUNT)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${ARTIFACT_PREFIX}-heavy-scene.png`) })

    await selectCanvasTool(page, 'Pointer')
    const firstNode = getCanvasNodeById(page, 'perf-node-0')
    await expect(firstNode).toBeVisible({ timeout: 10_000 })

    const interactions: Record<string, InteractionSummary> = {}
    interactions.propertyChange = await measureInteraction(page, async () => {
      await selectFirstCanvasNodes(page, 1)
      await page.evaluate(() => {
        window.__WA_CANVAS_PERF_RUNTIME__?.updateSelectedNodeSurface()
      })
    })

    for (const selectedCount of SELECTED_COUNTS) {
      await selectFirstCanvasNodes(page, selectedCount)
      interactions[`toolbarFillSelected${selectedCount}`] = await measureInteraction(
        page,
        async () => {
          await page
            .getByRole('button', {
              name: selectedCount % 2 === 0 ? 'Select Red color' : 'Select Blue color',
            })
            .first()
            .click()
        },
      )

      interactions[`directUpdateSelected${selectedCount}`] = await measureInteraction(
        page,
        async () => {
          await page.evaluate(() => {
            window.__WA_CANVAS_PERF_RUNTIME__?.updateSelectedNodeSurface()
          })
        },
      )

      interactions[`toolbarStrokeSizeSelected${selectedCount}`] = await measureInteraction(
        page,
        async () => {
          await dragStrokeSizeSlider(page)
        },
      )
    }

    for (const selectedCount of SELECTED_COUNTS) {
      await selectFirstCanvasNodes(page, selectedCount)
      interactions[`dragSelected${selectedCount}`] = await measureInteraction(page, async () => {
        await dragCanvasNode(page, firstNode, { x: 30, y: 20 })
      })

      interactions[`handlerDragSelected${selectedCount}`] = await measureInteraction(
        page,
        async () => {
          await page.evaluate(() => {
            window.__WA_CANVAS_PERF_RUNTIME__?.profileSelectedNodeDrag({
              delta: { x: 30, y: 20 },
              steps: 12,
            })
          })
        },
      )
    }

    await clearCanvasSelection(page)
    const viewport = getViewportControls(page)
    interactions.zoomButtons = await measureInteraction(page, async () => {
      for (let index = 0; index < 4; index += 1) {
        await viewport.zoomIn.click()
      }
      for (let index = 0; index < 4; index += 1) {
        await viewport.zoomOut.click()
      }
    })

    interactions.wheelPan = await measureInteraction(page, async () => {
      const box = await getCanvasPane(page).boundingBox()
      if (!box) throw new Error('Canvas pane is not visible')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      for (let index = 0; index < 12; index += 1) {
        await page.mouse.wheel(0, 180)
      }
    })

    await moveMouseToCanvasCenter(page)
    interactions.ctrlWheelZoom = await measureControlWheelInteraction(page, async () => {
      await ctrlWheelZoom(page)
    })

    interactions.viewportCoordinateRegression = await measureInteraction(page, async () => {
      await selectCanvasTool(page, 'Pointer')
      const coordinateNodeId = 'perf-embed-0'
      await page.evaluate((nodeId) => {
        const runtime = window.__WA_CANVAS_PERF_RUNTIME__
        if (!runtime) throw new Error('Missing canvas performance runtime')
        runtime.seedCoordinateProbeNode({
          id: nodeId,
          start: { x: 120, y: 120 },
        })
      }, coordinateNodeId)
      await waitForRuntimeNodeCount(page, NODE_COUNT + 1)
      const coordinateNode = getCanvasNodeById(page, coordinateNodeId)
      await expect(coordinateNode).toBeVisible({ timeout: 10_000 })
      const before = await getRuntimeNodePosition(page, coordinateNodeId)
      await page.evaluate((position) => {
        window.__WA_CANVAS_PERF_RUNTIME__?.setViewport({
          x: 360 - position.x * 2,
          y: 240 - position.y * 2,
          zoom: 2,
        })
      }, before)
      await expect(coordinateNode).toBeVisible({ timeout: 10_000 })
      await waitForStableLocatorPosition(coordinateNode)
      const positionedBefore = await getRuntimeNodePosition(page, coordinateNodeId)
      await dragCanvasNode(page, coordinateNode, { x: 40, y: 20 })
      const after = await getRuntimeNodePosition(page, coordinateNodeId)

      expect(round(after.x - positionedBefore.x)).toBe(20)
      expect(round(after.y - positionedBefore.y)).toBe(10)
    })

    interactions.marqueeSelection = await measureInteraction(page, async () => {
      await dragOnCanvas(page, { x: 20, y: 20 }, { x: 760, y: 520 }, { steps: 24 })
    })

    await page.evaluate((count) => {
      const runtime = window.__WA_CANVAS_PERF_RUNTIME__
      if (!runtime) throw new Error('Missing canvas performance runtime')
      runtime.clearCanvas()
      runtime.seedStrokeNodes({
        count,
        columns: 10,
        spacingX: 220,
        spacingY: 140,
        start: { x: 120, y: 160 },
        pointsPerStroke: 100,
      })
    }, STROKE_NODE_COUNT)
    await waitForRuntimeNodeCount(page, STROKE_NODE_COUNT)

    await moveMouseToCanvasCenter(page)
    interactions.ctrlWheelZoomStrokes = await measureControlWheelInteraction(page, async () => {
      await ctrlWheelZoomWithStrokeAssertion(page)
    })
    await expectStrokeCameraIdle(page)

    const payload = {
      nodeCount: NODE_COUNT,
      strokeNodeCount: STROKE_NODE_COUNT,
      selectedCounts: SELECTED_COUNTS,
      counts: await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getCounts()),
      interactions,
    }

    await writeFile(
      path.join(ARTIFACT_DIR, `${ARTIFACT_PREFIX}.json`),
      JSON.stringify(payload, null, 2),
    )
    await context.tracing.stop({ path: path.join(ARTIFACT_DIR, `${ARTIFACT_PREFIX}.zip`) })

    expect(payload.counts?.nodes).toBe(STROKE_NODE_COUNT)
    expect(payload.interactions.ctrlWheelZoom.metrics['canvas.react.commit']).toBeUndefined()
    expect(payload.interactions.ctrlWheelZoomStrokes.metrics['canvas.react.commit']).toBeUndefined()
  })
})

async function waitForCanvasPerformanceRuntime(page: Page) {
  await page.waitForFunction(() => Boolean(window.__WA_CANVAS_PERF_RUNTIME__), null, {
    timeout: 10_000,
  })
}

async function selectFirstCanvasNodes(page: Page, count: number) {
  await page.evaluate((selectedCount) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.selectFirstNodes(selectedCount)
  }, count)
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="canvas-node"][data-node-id="perf-node-0"]')
        ?.getAttribute('data-node-selected') === 'true',
    null,
    { timeout: 10_000 },
  )
  await page.waitForFunction(
    (expected) => window.__WA_CANVAS_PERF_RUNTIME__?.getSelectedCount() === expected,
    count,
    { timeout: 10_000 },
  )
}

async function clearCanvasSelection(page: Page) {
  await page.evaluate(() => {
    window.__WA_CANVAS_PERF_RUNTIME__?.selectFirstNodes(0)
  })
  await page.waitForFunction(
    () => window.__WA_CANVAS_PERF_RUNTIME__?.getSelectedCount() === 0,
    null,
    {
      timeout: 10_000,
    },
  )
}

async function waitForRuntimeNodeCount(page: Page, count: number) {
  await expect
    .poll(
      async () => page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getCounts().nodes ?? null),
      { timeout: 30_000 },
    )
    .toBe(count)
}

async function dragStrokeSizeSlider(page: Page) {
  const slider = page
    .getByRole('toolbar', { name: 'Canvas conditional toolbar' })
    .locator('[data-slot="slider"]')
    .first()
  await expect(slider).toBeVisible({ timeout: 10_000 })
  const box = await slider.boundingBox()
  if (!box) throw new Error('Stroke size slider is not visible')

  const y = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.25, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 12 })
  await page.mouse.up()
}

async function moveMouseToCanvasCenter(page: Page) {
  const box = await getCanvasPane(page).boundingBox()
  if (!box) throw new Error('Canvas pane is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(100)
}

async function ctrlWheelZoom(page: Page) {
  for (let index = 0; index < 12; index += 1) {
    await page.mouse.wheel(0, index % 2 === 0 ? -120 : 120)
  }
}

async function ctrlWheelZoomWithStrokeAssertion(page: Page) {
  const initialState = await readStrokeVisualState(page)
  await page.mouse.wheel(0, -120)
  const movingState = await expectStrokeCameraMoving(page)
  expect(movingState.viewBox).toBe(initialState.viewBox)
  for (let index = 1; index < 12; index += 1) {
    await page.mouse.wheel(0, index % 2 === 0 ? -120 : 120)
  }
}

async function expectStrokeCameraMoving(page: Page) {
  await page.waitForFunction(
    () =>
      document.querySelector('.canvas-scene__viewport')?.getAttribute('data-camera-state') ===
      'moving',
    null,
    { timeout: 5_000 },
  )
  const state = await readStrokeVisualState(page)
  expect(state.cameraState).toBe('moving')
  expect(state.detailVisibility).toBe('visible')
  return state
}

async function expectStrokeCameraIdle(page: Page) {
  await page.waitForFunction(
    () =>
      document.querySelector('.canvas-scene__viewport')?.getAttribute('data-camera-state') ===
      'idle',
    null,
    { timeout: 5_000 },
  )
  const state = await readStrokeVisualState(page)
  expect(state.cameraState).toBe('idle')
  expect(state.detailVisibility).toBe('visible')
  return state
}

async function readStrokeVisualState(page: Page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.canvas-scene__viewport')
    const detail = document.querySelector('.canvas-stroke-detail-path')
    const svg = document.querySelector('.canvas-stroke-visual')
    if (!detail || !svg) {
      throw new Error('Missing stroke visual path')
    }

    return {
      cameraState: viewport?.getAttribute('data-camera-state'),
      detailVisibility: getComputedStyle(detail).visibility,
      viewBox: svg.getAttribute('viewBox'),
    }
  })
}

async function getRuntimeNodePosition(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const position = window.__WA_CANVAS_PERF_RUNTIME__?.getNodePosition(id)
    if (!position) throw new Error(`Missing runtime node position for ${id}`)
    return position
  }, nodeId)
}

async function measureInteraction(
  page: Page,
  action: () => Promise<void>,
  { settleMs = 350 }: { settleMs?: number } = {},
): Promise<InteractionSummary> {
  await page.evaluate(() => {
    if (window.__WA_CANVAS_PERF__) {
      window.__WA_CANVAS_PERF__.entries = []
    }
  })
  const start = Date.now()
  await action()
  const wallMs = Date.now() - start
  if (settleMs > 0) {
    await page.waitForTimeout(settleMs)
  }
  const entries = await page.evaluate(() => window.__WA_CANVAS_PERF__?.entries ?? [])
  return {
    wallMs,
    metrics: summarizeMetrics(entries),
  }
}

async function measureControlWheelInteraction(
  page: Page,
  action: () => Promise<void>,
): Promise<InteractionSummary> {
  await page.keyboard.down('Control')
  try {
    return await measureInteraction(page, action, { settleMs: 0 })
  } finally {
    await page.keyboard.up('Control')
  }
}

function summarizeMetrics(entries: Array<CanvasPerformanceMetric>): InteractionSummary['metrics'] {
  const groups = new Map<string, Array<number>>()
  for (const entry of entries) {
    const values = groups.get(entry.name) ?? []
    values.push(entry.durationMs)
    groups.set(entry.name, values)
  }

  return Object.fromEntries(
    Array.from(groups.entries()).map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const totalMs = values.reduce((sum, value) => sum + value, 0)
      return [
        name,
        {
          count: values.length,
          totalMs: round(totalMs),
          avgMs: round(totalMs / values.length),
          maxMs: round(sorted[sorted.length - 1] ?? 0),
          p95Ms: round(sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0),
        },
      ]
    }),
  )
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function readCanvasPerfCount(envName: string, fallback: number) {
  const rawValue = process.env[envName]
  if (rawValue === undefined) {
    return fallback
  }

  const value = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(value) || value < 1) {
    console.warn(`${envName} must be a positive integer; using ${fallback}`)
    return fallback
  }

  return value
}

async function waitForStableLocatorPosition(locator: Locator) {
  await expect
    .poll(
      async () => {
        const firstBox = await locator.boundingBox()
        await locator.page().evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            }),
        )
        const secondBox = await locator.boundingBox()
        if (!firstBox || !secondBox) {
          return false
        }

        return round(firstBox.x) === round(secondBox.x) && round(firstBox.y) === round(secondBox.y)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
}
