import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodes,
  getCanvasPane,
  getCanvasEdgeById,
  getCommittedSelectedCanvasNodes,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  setCanvasSelectionViaRuntime,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import { getBrowserPrimaryModifier } from './helpers/keyboard-helpers'
import type { Locator, Page } from '@playwright/test'

const campaignName = testName('CnvCtx')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas context menu workflows', () => {
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
      spacingX: 180,
      start: { x: 460, y: 220 },
    })
    await selectCanvasTool(page, 'Pointer')
  })

  test('selects all canvas items from the pane menu', async ({ page }) => {
    await rightClickNode(page, getCanvasNodeById(page, 'perf-node-0'))
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.keyboard.press('Escape')

    await rightClickEmptyPane(page)
    await page.getByRole('menuitem', { name: 'Select All' }).click()

    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(3)
  })

  test('duplicates from the node menu and deletes the duplicated selection', async ({ page }) => {
    await rightClickNode(page, getCanvasNodeById(page, 'perf-node-0'))
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect.poll(() => getCanvasNodes(page).count()).toBe(4)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await page.keyboard.press('Delete')

    await expect.poll(() => getCanvasNodes(page).count()).toBe(3)
  })

  test('exposes arrange actions for multi-node selections', async ({ page }) => {
    const modifier = await getBrowserPrimaryModifier(page)
    await page.keyboard.down(modifier)
    try {
      await getCanvasNodeById(page, 'perf-node-0').click()
      await getCanvasNodeById(page, 'perf-node-1').click()
    } finally {
      await page.keyboard.up(modifier)
    }
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(2)

    await rightClickNode(page, getCanvasNodeById(page, 'perf-node-0'))
    await page.getByRole('menuitem', { name: 'Arrange' }).hover()

    await expect(page.getByRole('menuitem', { name: 'Align Left' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Distribute H' })).toBeVisible()
  })

  test('opens edge and mixed-selection menus and supports copy cut paste actions', async ({
    page,
  }) => {
    await seedCanvasEdgeViaRuntime(page, {
      id: 'ctx-edge',
      source: 'perf-node-0',
      target: 'perf-node-1',
    })
    await rightClickEdge(page, 'ctx-edge')
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.keyboard.press('Escape')

    await setCanvasSelectionViaRuntime(page, {
      nodeIds: ['perf-node-0'],
      edgeIds: ['ctx-edge'],
    })
    await rightClickNode(page, getCanvasNodeById(page, 'perf-node-0'))
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Copy' }).click()

    await rightClickEmptyPane(page)
    await page.getByRole('menuitem', { name: 'Paste' }).click()
    await expect.poll(() => getCanvasNodes(page).count()).toBeGreaterThan(3)

    await rightClickNode(page, getCanvasNodeById(page, 'perf-node-0'))
    await page.getByRole('menuitem', { name: 'Cut' }).click()
    await expect.poll(() => getCanvasNodes(page).count()).toBe(3)
  })
})

async function rightClickNode(page: Page, node: Locator) {
  const box = await node.boundingBox()
  if (!box) throw new Error('Canvas node is not visible')

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
}

async function rightClickEmptyPane(page: Page) {
  const box = await getCanvasPane(page).boundingBox()
  if (!box) throw new Error('Canvas pane is not visible')

  // Use a proportional bottom-right inset so the click stays inside the pane while avoiding
  // the seeded nodes clustered near the top-left/middle of these fixtures.
  const inset = Math.max(40, Math.min(box.width, box.height) * 0.1)
  await page.mouse.click(box.x + box.width - inset, box.y + box.height - inset, {
    button: 'right',
  })
  await expect(page.getByRole('menu')).toBeVisible()
}

async function rightClickEdge(page: Page, edgeId: string) {
  const edge = getCanvasEdgeById(page, edgeId).getByTestId('canvas-edge-interaction')
  const point = await edge.evaluate((path) => {
    const box = path.getBoundingClientRect()
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  })
  await page.mouse.click(point.x, point.y, { button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
}
