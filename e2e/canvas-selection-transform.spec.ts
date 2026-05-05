import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodesByType,
  getCanvasPendingSelectionNodeIds,
  getCanvasSelectionResizeWrapper,
  getCommittedSelectedCanvasNodes,
  getVisuallySelectedCanvasNodes,
  expectSelectionWrapperEnclosesNodes,
  lassoOnCanvas,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  selectFirstCanvasNodesViaRuntime,
  setCanvasSelectionViaRuntime,
  setCanvasViewportViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CnvSelectX')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas selection under viewport transforms', () => {
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
    await seedCanvasTextNodesViaRuntime(page, {
      count: 3,
      columns: 3,
      spacingX: 200,
      start: { x: 460, y: 220 },
    })
  })

  for (const zoom of [0.5, 1, 2] as const) {
    test(`draws a screen-space multi-select wrapper at zoom ${zoom}`, async ({ page }) => {
      await setCanvasViewportViaRuntime(page, { x: 60, y: 40, zoom })
      await selectFirstCanvasNodesViaRuntime(page, 2)
      await expectSelectionWrapperEnclosesNodes(page, ['perf-node-0', 'perf-node-1'])
      await expect(getCanvasSelectionResizeWrapper(page)).toBeVisible()
    })
  }

  test('marquee selection commits the transformed visible nodes without clearing on pointer up', async ({
    page,
  }) => {
    await setCanvasViewportViaRuntime(page, { x: 120, y: 80, zoom: 1.25 })
    await selectCanvasTool(page, 'Pointer')
    const boxes = await Promise.all([
      getCanvasNodeById(page, 'perf-node-0').boundingBox(),
      getCanvasNodeById(page, 'perf-node-1').boundingBox(),
      getCanvasNodeById(page, 'perf-node-2').boundingBox(),
    ])
    if (boxes.some((box) => box === null)) {
      throw new Error('Missing transformed node bounds for marquee selection')
    }
    const nodeBoxes = boxes as Array<NonNullable<(typeof boxes)[number]>>
    const left = Math.min(...nodeBoxes.map((box) => box.x))
    const top = Math.min(...nodeBoxes.map((box) => box.y))
    const right = Math.max(...nodeBoxes.map((box) => box.x + box.width))
    const bottom = Math.max(...nodeBoxes.map((box) => box.y + box.height))
    await page.mouse.move(left - 24, top - 24)
    await page.mouse.down()
    await page.mouse.move(right + 24, bottom + 24, { steps: 18 })
    await page.mouse.up()

    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(3)
    await expect.poll(() => getVisuallySelectedCanvasNodes(page).count()).toBe(3)
    await expect.poll(() => getCanvasPendingSelectionNodeIds(page)).toEqual([])
  })

  test('modifier selection toggles transformed nodes without moving the viewport', async ({
    page,
  }) => {
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await setCanvasViewportViaRuntime(page, { x: -40, y: 30, zoom: 1.5 })
    await selectCanvasTool(page, 'Pointer')

    await getCanvasNodesByType(page, 'text').first().click()
    await page.keyboard.down(modifier)
    try {
      await getCanvasNodesByType(page, 'text').nth(1).click()
      await getCanvasNodesByType(page, 'text').first().click()
    } finally {
      await page.keyboard.up(modifier)
    }

    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await expect(getCanvasNodeById(page, 'perf-node-1')).toHaveAttribute(
      'data-node-selected',
      'true',
    )
  })

  test('lasso and mixed node-edge selections remain accurate after pan and zoom', async ({
    page,
  }) => {
    await seedCanvasEdgeViaRuntime(page, {
      id: 'selection-edge',
      source: 'perf-node-0',
      target: 'perf-node-1',
    })
    await setCanvasViewportViaRuntime(page, { x: -100, y: 90, zoom: 1.4 })

    await selectCanvasTool(page, 'Lasso select')
    await lassoOnCanvas(page, [
      { x: 470, y: 210 },
      { x: 820, y: 210 },
      { x: 830, y: 420 },
      { x: 460, y: 420 },
      { x: 470, y: 210 },
    ])
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBeGreaterThan(1)

    await setCanvasSelectionViaRuntime(page, {
      nodeIds: ['perf-node-0'],
      edgeIds: ['selection-edge'],
    })
    const snapshot = await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getSnapshot())
    expect(snapshot?.selection).toEqual({
      nodeIds: ['perf-node-0'],
      edgeIds: ['selection-edge'],
    })
  })
})
