import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  createCanvas,
  dragCanvasNode,
  dragOnCanvas,
  getCanvasNodeById,
  getCanvasNodes,
  getCanvasPane,
  getViewportControls,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const ARTIFACT_DIR = path.resolve('output/playwright')
const NODE_COUNT = Number(process.env.CANVAS_PERF_NODE_COUNT ?? 250)
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

    await expect.poll(() => getCanvasNodes(page).count(), { timeout: 30_000 }).toBe(NODE_COUNT)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'canvas-performance-heavy-scene.png') })

    await selectCanvasTool(page, 'Pointer')
    const firstNode = getCanvasNodeById(page, 'perf-node-0')
    await expect(firstNode).toBeVisible({ timeout: 10_000 })

    const interactions: Record<string, InteractionSummary> = {}
    interactions.propertyChange = await measureInteraction(page, async () => {
      await page.evaluate(() => {
        window.__WA_CANVAS_PERF_RUNTIME__?.updateFirstNodeSurface()
      })
    })

    await page.evaluate(() => {
      window.__WA_CANVAS_PERF_RUNTIME__?.selectFirstNode()
    })
    await expect(firstNode).toHaveAttribute('data-node-selected', 'true', { timeout: 10_000 })

    interactions.dragNode = await measureInteraction(page, async () => {
      await dragCanvasNode(page, firstNode, { x: 180, y: 80 })
    })

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

    interactions.marqueeSelection = await measureInteraction(page, async () => {
      await dragOnCanvas(page, { x: 20, y: 20 }, { x: 760, y: 520 }, { steps: 24 })
    })

    const payload = {
      nodeCount: NODE_COUNT,
      counts: await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getCounts()),
      interactions,
    }

    await writeFile(
      path.join(ARTIFACT_DIR, 'canvas-performance-baseline.json'),
      JSON.stringify(payload, null, 2),
    )
    await context.tracing.stop({ path: path.join(ARTIFACT_DIR, 'canvas-performance-baseline.zip') })

    expect(payload.counts?.nodes).toBe(NODE_COUNT)
  })
})

async function waitForCanvasPerformanceRuntime(page: Page) {
  await page.waitForFunction(() => Boolean(window.__WA_CANVAS_PERF_RUNTIME__), null, {
    timeout: 10_000,
  })
}

async function measureInteraction(
  page: Page,
  action: () => Promise<void>,
): Promise<InteractionSummary> {
  await page.evaluate(() => {
    if (window.__WA_CANVAS_PERF__) {
      window.__WA_CANVAS_PERF__.entries = []
    }
  })
  const start = Date.now()
  await action()
  await page.waitForTimeout(350)
  const wallMs = Date.now() - start
  const entries = await page.evaluate(() => window.__WA_CANVAS_PERF__?.entries ?? [])
  return {
    wallMs,
    metrics: summarizeMetrics(entries),
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
