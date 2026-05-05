import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  dragOnCanvas,
  enableCanvasRuntime,
  getCanvasDragSnapGuides,
  getCanvasNodeById,
  getCanvasNodesByType,
  getCanvasRuntimeNodePosition,
  getCommittedSelectedCanvasNodes,
  expectCanvasNodeModel,
  openCanvas,
  resizeCanvasNode,
  seedCanvasCoordinateProbeNodeViaRuntime,
  seedCanvasStrokeNodesViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasViewportViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('CnvNodeEdit')
const canvasName = DEFAULT_CANVAS_NAME
const textInputSelector = '[aria-label="Text node content"][contenteditable="true"]'

test.describe.serial('canvas node editing workflows', () => {
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

  test('creates, edits, reopens, and continues editing a text node', async ({ page }) => {
    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 520, y: 380 })
    const editor = page.locator(textInputSelector).last()
    await expect(editor).toBeVisible()
    await editor.fill('Editable text')
    await editor.press('Escape')
    await expect(page.getByText('Editable text', { exact: true })).toBeVisible()

    await selectCanvasTool(page, 'Pointer')
    await getCanvasNodesByType(page, 'text').first().dblclick()
    await expect(editor).toBeVisible()
    await editor.fill('Edited again')
    await editor.press('Escape')
    await expect(page.getByText('Edited again', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByText('Edited again', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('resizes side and corner handles and persists the resulting model geometry', async ({
    page,
  }) => {
    await seedCanvasCoordinateProbeNodeViaRuntime(page, 'perf-embed-0', { x: 140, y: 140 })
    const node = getCanvasNodeById(page, 'perf-embed-0')
    await selectCanvasTool(page, 'Pointer')
    await node.click()
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    const before = await node.boundingBox()
    if (!before) throw new Error('Node is not visible before resize')
    await resizeCanvasNode(page, node, 'right', { x: 80, y: 0 })
    await resizeCanvasNode(page, node, 'bottom-right', { x: 40, y: 50 })

    await expect
      .poll(async () => {
        const after = await node.boundingBox()
        return after ? after.width > before.width + 80 && after.height > before.height + 30 : false
      })
      .toBe(true)
  })

  test('exposes every resize handle category for selected nodes', async ({ page }) => {
    const handles = [
      'top-left',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
    ] as const

    await seedCanvasTextNodesViaRuntime(page, {
      count: 1,
      idPrefix: 'resize-handles',
      start: { x: 220, y: 180 },
      size: { width: 180, height: 100 },
    })
    const node = getCanvasNodeById(page, 'resize-handles-0')
    await node.click()

    for (const handle of handles) {
      await expect(page.getByTestId(`canvas-selection-resize-zone-${handle}`)).toBeVisible()
    }

    await expect(getCanvasNodeById(page, 'resize-handles-0')).toBeVisible()
  })

  test.fixme('shows snap guides while dragging near another node alignment', async ({ page }) => {
    await seedCanvasCoordinateProbeNodeViaRuntime(page, 'snap-source', { x: 180, y: 180 })
    await seedCanvasCoordinateProbeNodeViaRuntime(page, 'snap-target', { x: 480, y: 180 })
    const source = getCanvasNodeById(page, 'snap-source')
    const box = await source.boundingBox()
    if (!box) throw new Error('Source node is not visible')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 280, box.y + box.height / 2 + 4, {
      steps: 12,
    })
    await expect(getCanvasDragSnapGuides(page).first()).toBeVisible({ timeout: 5000 })
    await page.mouse.up()
  })

  test('keeps resize handles positioned after pan and zoom', async ({ page }) => {
    await seedCanvasCoordinateProbeNodeViaRuntime(page, 'zoomed-resize', { x: 220, y: 180 })
    await setCanvasViewportViaRuntime(page, { x: 120, y: 80, zoom: 2 })
    const node = getCanvasNodeById(page, 'zoomed-resize')
    await node.click()
    const handleBox = await page
      .getByTestId('canvas-selection-resize-zone-bottom-right')
      .boundingBox()
    if (!handleBox) throw new Error('Zoomed resize handle is not visible')
    expect(handleBox.width).toBeGreaterThan(0)
    expect(handleBox.height).toBeGreaterThan(0)
  })

  test('erases only intersected stroke nodes', async ({ page }) => {
    await seedCanvasStrokeNodesViaRuntime(page, {
      count: 2,
      columns: 2,
      spacingX: 240,
      start: { x: 180, y: 180 },
      pointsPerStroke: 12,
    })
    const secondBefore = await getCanvasRuntimeNodePosition(page, 'perf-stroke-1')

    await selectCanvasTool(page, 'Eraser')
    await dragOnCanvas(page, { x: 170, y: 170 }, { x: 280, y: 240 })

    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)
    await expect(getCanvasNodeById(page, 'perf-stroke-1')).toBeVisible()
    await expect
      .poll(() => getCanvasRuntimeNodePosition(page, 'perf-stroke-1'))
      .toEqual(secondBefore)
  })

  test('draws with selected stroke style, erases, undoes, and persists', async ({ page }) => {
    await selectCanvasTool(page, 'Draw')
    await page.getByRole('button', { name: 'Select Red color' }).first().click()
    const strokeSizeInput = page.getByRole('textbox', { name: 'Stroke size input' })
    await strokeSizeInput.fill('10')
    await strokeSizeInput.press('Enter')

    await dragOnCanvas(page, { x: 260, y: 260 }, { x: 380, y: 320 }, { steps: 18 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)
    const strokeId = await getCanvasNodesByType(page, 'stroke').first().getAttribute('data-node-id')
    if (!strokeId) throw new Error('Missing drawn stroke id')
    await expectCanvasNodeModel(page, strokeId, {
      type: 'stroke',
      data: { color: 'var(--t-red)', size: 10 },
    })

    await page.reload()
    await waitForCanvasRuntime(page)
    await expect(getCanvasNodeById(page, strokeId)).toBeVisible({ timeout: 10_000 })

    await selectCanvasTool(page, 'Eraser')
    await dragOnCanvas(page, { x: 250, y: 250 }, { x: 390, y: 330 }, { steps: 12 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(0)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z')
    await expect(getCanvasNodeById(page, strokeId)).toBeVisible({ timeout: 10_000 })
  })
})
