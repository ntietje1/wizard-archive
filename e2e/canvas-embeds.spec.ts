import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createMap } from './helpers/map-helpers'
import { createNote } from './helpers/sidebar-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  createFreshCanvasForTest,
  dragCanvasNode,
  enableCanvasRuntime,
  getCanvasNodes,
  getCanvasPane,
  expectCanvasRuntimeSelection,
  getCanvasNodeById,
  getCanvasNodesByType,
  getCanvasRuntimeCanvasId,
  getCanvasRuntimeNodePosition,
  getEmbeddedCanvasPreview,
  getEmbeddedCanvasRoot,
  openCanvas,
  seedCanvasEdgeViaRuntime,
  seedCanvasEmbedNodeViaRuntime,
  seedCanvasTextNodesViaRuntime,
  selectCanvasTool,
  waitForCanvasRuntime,
  wheelCanvasPane,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page, TestInfo } from '@playwright/test'

const campaignName = testName('CnvEmbeds')

test.describe.serial('canvas embedded preview behavior', () => {
  test.setTimeout(90_000)

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
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
  })

  test('creates note, map, and canvas embeds through real sidebar drag and pane menu actions', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueCanvasName('Real Embed Host', testInfo)
    const noteName = uniqueCanvasName('Embed Note', testInfo)
    const mapName = uniqueCanvasName('Embed Map', testInfo)
    const canvasName = uniqueCanvasName('Embed Canvas', testInfo)

    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    await openCreateNewDashboard(page)
    await createMap(page, mapName)
    await openCreateNewDashboard(page)
    await createCanvas(page, canvasName)
    await createFreshCanvasForTest(page, campaignName, hostName)
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')

    await dragSidebarItemToCanvas(page, noteName, { xRatio: 0.3, yRatio: 0.35 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(1)
    await dragSidebarItemToCanvas(page, mapName, { xRatio: 0.55, yRatio: 0.35 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(2)
    await dragSidebarItemToCanvas(page, canvasName, { xRatio: 0.8, yRatio: 0.35 })
    await expect.poll(() => getCanvasNodes(page).count()).toBe(3)

    await openPaneNewMenu(page, { xRatio: 0.88, yRatio: 0.88 })
    await page.getByRole('menuitem', { name: 'Note' }).click()
    await expect.poll(() => getCanvasNodes(page).count()).toBe(4)
  })

  test('drags the parent embed when the gesture starts on embedded child nodes', async ({
    page,
  }, testInfo) => {
    const { hostName, sourceCanvasId } = await createEmbeddedCanvasFixture(page, testInfo)
    await openHostCanvas(page, hostName)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embed-source',
      sidebarItemId: sourceCanvasId,
      position: { x: 220, y: 180 },
      width: 420,
      height: 300,
    })
    await expect(getEmbeddedCanvasRoot(page)).toBeVisible({ timeout: 15_000 })
    const embedNode = getCanvasNodeById(page, 'embed-source')
    const before = await getCanvasRuntimeNodePosition(page, 'embed-source')

    await selectCanvasTool(page, 'Pointer')
    await dragCanvasNode(
      page,
      embedNode,
      { x: 90, y: 50 },
      { positionRatio: { xRatio: 0.5, yRatio: 0.5 } },
    )

    await expect
      .poll(async () => {
        const after = await getCanvasRuntimeNodePosition(page, 'embed-source')
        return after.x > before.x + 60 && after.y > before.y + 25
      })
      .toBe(true)
  })

  test('keeps embedded canvas children render-only for selection, editing, menus, and wheel', async ({
    page,
  }, testInfo) => {
    const { hostName, sourceCanvasId } = await createEmbeddedCanvasFixture(page, testInfo)
    await openHostCanvas(page, hostName)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embed-source',
      sidebarItemId: sourceCanvasId,
      position: { x: 220, y: 180 },
      width: 420,
      height: 300,
    })
    const embedNode = getCanvasNodeById(page, 'embed-source')
    await expect(getEmbeddedCanvasPreview(page)).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(() => getCanvasNodesByType(page, 'text').count(), { timeout: 15_000 })
      .toBeGreaterThan(0)

    await selectCanvasTool(page, 'Pointer')
    await clickEmbeddedPreview(page, { x: 180, y: 120 }, { clickCount: 2 })
    await page.keyboard.type('should not edit embedded child')
    await expect(
      page.locator('[aria-label="Text node content"][contenteditable="true"]'),
    ).toHaveCount(0)
    await expectCanvasRuntimeSelection(page, { nodeIds: ['embed-source'], edgeIds: [] })

    await clickEmbeddedPreview(page, { x: 180, y: 120 }, { button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    await page.keyboard.press('Escape')

    const beforeWheel = await getCanvasRuntimeNodePosition(page, 'embed-source')
    await wheelCanvasPane(page, { x: 0, y: 180 })
    await expect
      .poll(async () => {
        const afterWheel = await getCanvasRuntimeNodePosition(page, 'embed-source')
        return afterWheel
      })
      .toEqual(beforeWheel)

    await embedNode.click()
    await expectCanvasRuntimeSelection(page, { nodeIds: ['embed-source'], edgeIds: [] })
  })

  test('opens the embedded target from the embed context menu', async ({ page }, testInfo) => {
    const { hostName, sourceCanvasId, sourceName } = await createEmbeddedCanvasFixture(
      page,
      testInfo,
    )
    await openHostCanvas(page, hostName)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embed-open-target',
      sidebarItemId: sourceCanvasId,
      position: { x: 240, y: 180 },
      width: 360,
      height: 260,
    })

    const embedNode = getCanvasNodeById(page, 'embed-open-target')
    const box = await embedNode.boundingBox()
    if (!box) throw new Error('Embed node is not visible')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Open' }).click()

    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(sourceName, {
      timeout: 10_000,
    })
  })
})

async function createEmbeddedCanvasFixture(page: Page, testInfo: TestInfo) {
  const sourceName = uniqueCanvasName('Source', testInfo)
  const hostName = uniqueCanvasName('Host', testInfo)

  await createFreshCanvasForTest(page, campaignName, sourceName)
  await clearCanvasViaRuntime(page)
  await seedCanvasTextNodesViaRuntime(page, {
    count: 2,
    columns: 2,
    idPrefix: 'embed-child',
    labelPrefix: 'Embedded child',
    spacingX: 190,
    start: { x: 80, y: 80 },
  })
  await seedCanvasEdgeViaRuntime(page, {
    id: 'embed-child-edge',
    source: 'embed-child-0',
    target: 'embed-child-1',
  })
  await page.waitForTimeout(500)
  const sourceCanvasId = await getCanvasRuntimeCanvasId(page)

  await createFreshCanvasForTest(page, campaignName, hostName)
  await clearCanvasViaRuntime(page)

  return { hostName, sourceCanvasId, sourceName }
}

async function openHostCanvas(page: Page, hostName: string) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, hostName)
  await waitForCanvasRuntime(page)
  await clearCanvasViaRuntime(page)
}

function uniqueCanvasName(prefix: string, testInfo: TestInfo) {
  return `${prefix} ${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`
}

async function clickEmbeddedPreview(
  page: Page,
  offset: { x: number; y: number },
  options: { button?: 'left' | 'right'; clickCount?: number } = {},
) {
  const box = await getEmbeddedCanvasPreview(page).boundingBox()
  if (!box) {
    throw new Error('Embedded preview is not visible')
  }

  await page.mouse.click(box.x + offset.x, box.y + offset.y, options)
}

async function openCreateNewDashboard(page: Page) {
  await page.getByRole('navigation', { name: 'Sidebar' }).getByRole('link', { name: 'New' }).click()
}

async function dragSidebarItemToCanvas(
  page: Page,
  itemName: string,
  target: { xRatio: number; yRatio: number },
) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  const item = sidebar.getByRole('link', { name: itemName, exact: true })
  const sourceBox = await item.boundingBox()
  const paneBox = await getCanvasPane(page).boundingBox()
  if (!sourceBox || !paneBox) {
    throw new Error('Sidebar item or canvas pane is not visible')
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    paneBox.x + paneBox.width * target.xRatio,
    paneBox.y + paneBox.height * target.yRatio,
    { steps: 16 },
  )
  await page.mouse.up()
}

async function openPaneNewMenu(page: Page, target: { xRatio: number; yRatio: number }) {
  const paneBox = await getCanvasPane(page).boundingBox()
  if (!paneBox) throw new Error('Canvas pane is not visible')
  await page.mouse.click(
    paneBox.x + paneBox.width * target.xRatio,
    paneBox.y + paneBox.height * target.yRatio,
    {
      button: 'right',
    },
  )
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'New...' }).hover()
}
