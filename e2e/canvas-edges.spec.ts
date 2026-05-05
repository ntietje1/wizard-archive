import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  expectCanvasEdgeModel,
  expectCanvasRuntimeSelection,
  getCanvasNodeHandle,
  getCanvasEdgeById,
  getCanvasEdges,
  getCanvasNodesByType,
  getViewportControls,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  setCanvasSelectionViaRuntime,
  setCanvasViewportViaRuntime,
  selectCanvasTool,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Locator, Page } from '@playwright/test'

const campaignName = testName('CnvEdges')
const canvasName = DEFAULT_CANVAS_NAME
const textInputSelector = '[aria-label="Text node content"][contenteditable="true"]'

test.describe.serial('canvas edge workflows', () => {
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
    test.setTimeout(60_000)
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
    await createEdgeFixture(page)
  })

  test('creates edges through handle drag gestures and cancels invalid gestures', async ({
    page,
  }) => {
    const sourceNode = getNodeByText(page, 'Edge source')
    const targetNode = getNodeByText(page, 'Edge target')

    await dragConnectionHandle(page, sourceNode, targetNode)
    await expect.poll(() => getCanvasEdges(page).count()).toBe(1)

    await getViewportControls(page).undo.click()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(0)

    await startConnectionHandleDrag(page, sourceNode, null)
    await page.mouse.up()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(0)

    await dragConnectionHandle(page, sourceNode, sourceNode)
    await expect.poll(() => getCanvasEdges(page).count()).toBe(0)
  })

  test('creates, selects, restyles, changes type, and persists an edge', async ({ page }) => {
    await createEdgeFromFixtureNodes(page)
    const edge = getCanvasEdges(page).first()
    const edgeId = await edge.getAttribute('data-edge-id')
    if (!edgeId) throw new Error('Missing created edge id')

    await selectCanvasTool(page, 'Pointer')
    await clickEdgeInteraction(page, edge)
    await expect(edge).toHaveAttribute('data-edge-selected', 'true')

    await page.getByRole('button', { name: 'Change edge type to Straight' }).click()
    await expect(edge).toHaveAttribute('data-edge-type', 'straight')
    await page.getByRole('button', { name: 'Select Red color' }).first().click()
    await page.getByRole('slider', { name: 'Stroke size' }).fill('8')
    await page.keyboard.press('ArrowRight')
    await expectCanvasEdgeModel(page, edgeId, { type: 'straight' })
    await page.waitForTimeout(500)

    await page.reload()
    await waitForCanvasRuntime(page)
    await expect(getCanvasEdgeById(page, edgeId)).toHaveAttribute('data-edge-type', 'straight', {
      timeout: 10_000,
    })
  })

  test('deletes and restores an edge through undo and redo', async ({ page }) => {
    await createEdgeFromFixtureNodes(page)
    await expect.poll(() => getCanvasEdges(page).count()).toBe(1)
    const edge = getCanvasEdges(page).first()

    await selectCanvasTool(page, 'Pointer')
    await clickEdgeInteraction(page, edge)
    await page.keyboard.press('Delete')
    await expect.poll(() => getCanvasEdges(page).count()).toBe(0)

    const controls = getViewportControls(page)
    await controls.undo.click()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(1)
    await controls.redo.click()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(0)
  })

  test('keeps edge hit testing accurate after viewport zoom', async ({ page }) => {
    await createEdgeFromFixtureNodes(page)
    await getViewportControls(page).zoomIn.click()
    await getViewportControls(page).zoomIn.click()
    const edge = getCanvasEdges(page).first()

    await expectEdgeInteractionHitTarget(page, edge)
    await edge.locator('[data-testid="canvas-edge-interaction"]').dispatchEvent('click')

    await expect(edge).toHaveAttribute('data-edge-selected', 'true')
  })

  test('supports all edge types, styled edge models, and mixed node-edge selection', async ({
    page,
  }) => {
    const sourceNode = getNodeByText(page, 'Edge source')
    const targetNode = getNodeByText(page, 'Edge target')
    const sourceId = await sourceNode.getAttribute('data-node-id')
    const targetId = await targetNode.getAttribute('data-node-id')
    if (!sourceId || !targetId) throw new Error('Missing edge fixture node ids')

    for (const type of ['bezier', 'straight', 'step'] as const) {
      await seedCanvasEdgeViaRuntime(page, {
        id: `edge-${type}`,
        source: sourceId,
        target: targetId,
        type,
        style: { stroke: '#ef4444', opacity: 50, strokeWidth: 6 },
      })
      await expect(getCanvasEdgeById(page, `edge-${type}`)).toHaveCount(1)
      await expectCanvasEdgeModel(page, `edge-${type}`, {
        type,
        style: { stroke: '#ef4444', opacity: 50, strokeWidth: 6 },
      })
    }

    await setCanvasViewportViaRuntime(page, { x: 80, y: 40, zoom: 1.5 })
    await setCanvasSelectionViaRuntime(page, {
      nodeIds: [sourceId],
      edgeIds: ['edge-step'],
    })
    await expectCanvasRuntimeSelection(page, {
      nodeIds: [sourceId],
      edgeIds: ['edge-step'],
    })
  })
})

async function createEdgeFixture(page: Page) {
  await selectCanvasTool(page, 'Text')
  await clickCanvasAt(page, { x: 140, y: 420 })
  const sourceInput = page.locator(textInputSelector).last()
  await sourceInput.fill('Edge source')
  await sourceInput.press('Escape')
  await clickCanvasAt(page, { x: 40, y: 40 })

  await selectCanvasTool(page, 'Text')
  await clickCanvasAt(page, { x: 540, y: 420 })
  const targetInput = page.locator(textInputSelector).last()
  await targetInput.fill('Edge target')
  await targetInput.press('Escape')
  await clickCanvasAt(page, { x: 40, y: 40 })
}

async function createEdgeFromFixtureNodes(page: Page) {
  const sourceNode = getNodeByText(page, 'Edge source')
  const targetNode = getNodeByText(page, 'Edge target')
  const sourceId = await sourceNode.getAttribute('data-node-id')
  const targetId = await targetNode.getAttribute('data-node-id')
  if (!sourceId || !targetId) throw new Error('Missing edge fixture node ids')

  await seedCanvasEdgeViaRuntime(page, {
    source: sourceId,
    target: targetId,
  })
}

function getNodeByText(page: Page, text: string): Locator {
  return getCanvasNodesByType(page, 'text').filter({ hasText: text }).first()
}

async function clickEdgeInteraction(page: Page, edge: Locator) {
  await expectEdgeInteractionHitTarget(page, edge)
  const point = await getEdgeInteractionPoint(edge)
  await page.mouse.click(point.x, point.y)
}

async function dragConnectionHandle(page: Page, sourceNode: Locator, targetNode: Locator) {
  await startConnectionHandleDrag(page, sourceNode, targetNode)
  await page.mouse.up()
}

async function startConnectionHandleDrag(
  page: Page,
  sourceNode: Locator,
  targetNode: Locator | null,
) {
  await selectCanvasTool(page, 'Edges')
  const sourceHandle = getCanvasNodeHandle(sourceNode, 'right')
  const sourceBox = await sourceHandle.boundingBox()
  if (!sourceBox) {
    throw new Error('Connection handles are not visible')
  }

  const targetPoint = targetNode
    ? await getConnectionHandleCenter(getCanvasNodeHandle(targetNode, 'left'))
    : { x: sourceBox.x + sourceBox.width / 2 + 220, y: sourceBox.y + sourceBox.height / 2 + 140 }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 })
}

async function getConnectionHandleCenter(handle: Locator) {
  const box = await handle.boundingBox()
  if (!box) {
    throw new Error('Connection handle is not visible')
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function expectEdgeInteractionHitTarget(page: Page, edge: Locator) {
  const edgeId = await edge.getAttribute('data-edge-id')
  if (!edgeId) {
    throw new Error('Missing edge id')
  }

  await expect
    .poll(async () => getEdgeHitTargetId(page, await getEdgeInteractionPoint(edge)), {
      timeout: 10_000,
    })
    .toBe(edgeId)
}

async function getEdgeInteractionPoint(edge: Locator) {
  return edge.locator('[data-testid="canvas-edge-interaction"]').evaluate((path) => {
    const box = path.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  })
}

async function getEdgeHitTargetId(page: Page, point: { x: number; y: number }) {
  return page.evaluate(({ x, y }) => {
    return document
      .elementFromPoint(x, y)
      ?.closest('[data-canvas-edge-id]')
      ?.getAttribute('data-canvas-edge-id')
  }, point)
}
