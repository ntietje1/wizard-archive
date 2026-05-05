import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  enableCanvasRuntime,
  getCanvasNodeById,
  getCanvasNodeModel,
  getCanvasRuntimeSnapshot,
  openCanvas,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  waitForCanvasRuntime,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('CnvArrange')
const canvasName = DEFAULT_CANVAS_NAME

test.describe.serial('canvas arrange and reorder workflows', () => {
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
    await selectCanvasTool(page, 'Pointer')
  })

  test.fixme('aligns, distributes, and flips selected nodes through the arrange menu', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 3,
      columns: 3,
      idPrefix: 'arrange',
      start: { x: 120, y: 140 },
      spacingX: 210,
      spacingY: 130,
      size: { width: 100, height: 60 },
    })
    await selectNodesWithPrimaryModifier(page, ['arrange-0', 'arrange-1', 'arrange-2'])

    await runArrangeAction(page, 'Align Left')
    await expect
      .poll(async () => {
        const positions = await getNodePositions(page, ['arrange-0', 'arrange-1', 'arrange-2'])
        return new Set(positions.map((position) => position.x)).size
      })
      .toBe(1)

    await runArrangeAction(page, 'Distribute V')
    await expect
      .poll(async () => {
        const [first, second, third] = await getNodePositions(page, [
          'arrange-0',
          'arrange-1',
          'arrange-2',
        ])
        return Math.round(second.y - first.y - (third.y - second.y))
      })
      .toBe(0)

    const beforeFlip = await getNodePositions(page, ['arrange-0', 'arrange-1', 'arrange-2'])
    await runArrangeAction(page, 'Flip V')
    await expect
      .poll(async () => getNodePositions(page, ['arrange-0', 'arrange-1', 'arrange-2']))
      .toEqual([...beforeFlip].reverse())
  })

  test.fixme('reorders selected nodes visually and persists z-order after reload', async ({
    page,
  }) => {
    await seedCanvasTextNodesViaRuntime(page, {
      count: 3,
      columns: 3,
      idPrefix: 'stack',
      start: { x: 240, y: 180 },
      spacingX: 24,
      size: { width: 160, height: 100 },
    })
    await getCanvasNodeById(page, 'stack-0').click()

    const before = await getCanvasNodeModel(page, 'stack-0')
    await runReorderAction(page, 'Bring to front')
    await expect
      .poll(async () => (await getCanvasNodeModel(page, 'stack-0')).zIndex)
      .not.toBe(before.zIndex)

    const zIndex = (await getCanvasNodeModel(page, 'stack-0')).zIndex
    await page.reload()
    await waitForCanvasRuntime(page)
    await expect.poll(async () => (await getCanvasNodeModel(page, 'stack-0')).zIndex).toBe(zIndex)
  })
})

async function runArrangeAction(page: Page, action: string) {
  await openNodeContextMenu(page, getCanvasNodeById(page, 'arrange-0'))
  await page.getByRole('menuitem', { name: 'Arrange' }).hover()
  await page.getByRole('menuitem', { name: action }).click()
}

async function runReorderAction(page: Page, action: string) {
  await openNodeContextMenu(page, getCanvasNodeById(page, 'stack-0'))
  await page.getByRole('menuitem', { name: 'Reorder' }).hover()
  await page.getByRole('menuitem', { name: action }).click()
}

async function selectNodesWithPrimaryModifier(page: Page, nodeIds: Array<string>) {
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.down(modifier)
  try {
    for (const nodeId of nodeIds) {
      await getCanvasNodeById(page, nodeId).click()
    }
  } finally {
    await page.keyboard.up(modifier)
  }
}

async function openNodeContextMenu(page: Page, node: ReturnType<typeof getCanvasNodeById>) {
  const box = await node.boundingBox()
  if (!box) throw new Error('Canvas node is not visible')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
  await expect(page.getByRole('menu')).toBeVisible()
}

async function getNodePositions(page: Page, nodeIds: Array<string>) {
  const snapshot = await getCanvasRuntimeSnapshot(page)
  return nodeIds.map((nodeId) => {
    const node = snapshot.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) throw new Error(`Missing node ${nodeId}`)
    return node.position
  })
}
