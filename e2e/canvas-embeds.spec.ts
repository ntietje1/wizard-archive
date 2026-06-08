import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createMap } from './helpers/map-helpers'
import { createNote, selectableSidebarRow, sidebarLink } from './helpers/sidebar-helpers'
import {
  clearCanvasViaRuntime,
  createCanvas,
  createFreshCanvasForTest,
  dragCanvasNode,
  enableCanvasRuntime,
  getCanvasNodes,
  getCanvasPane,
  getCanvasEdgeById,
  expectCanvasRuntimeSelection,
  getCanvasNodeById,
  getCanvasNodesByType,
  getCanvasRuntimeSnapshot,
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
import {
  getCampaignIdFromRoute,
  getCampaignRouteFromUrl,
  getSidebarItemBySlug,
} from './helpers/convex-helpers'
import type { Locator, Page, TestInfo } from '@playwright/test'

const campaignName = testName('CnvEmbeds')
const MIN_EMBED_DRAG_DELTA_X = 60
const MIN_EMBED_DRAG_DELTA_Y = 25
const fixtureDir = path.resolve('test-results/fixtures')
const imageFileName = 'canvas-embed-upload.png'
const imageFilePath = path.join(fixtureDir, imageFileName)

test.describe.serial('canvas embedded preview behavior', () => {
  test.setTimeout(120_000)

  test.beforeAll(async ({ browser }) => {
    fs.mkdirSync(fixtureDir, { recursive: true })
    fs.writeFileSync(imageFilePath, createOnePixelPng())

    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath)

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
        return (
          after.x > before.x + MIN_EMBED_DRAG_DELTA_X && after.y > before.y + MIN_EMBED_DRAG_DELTA_Y
        )
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

  test('creates an empty canvas embed and links an external file into it', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueCanvasName('External Embed Host', testInfo)
    await createFreshCanvasForTest(page, campaignName, hostName)
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')

    const embedNode = await createEmptyEmbedFromPaneMenu(page)
    await embedNode.getByRole('button', { name: 'or link to an external file' }).click()
    await page
      .getByRole('textbox', { name: 'External file URL' })
      .fill('https://example.com/canvas-lore.wacz')
    await embedNode.getByRole('button', { exact: true, name: 'Link' }).click()

    await expect(embedNode.getByTestId('external-url-embed-card')).toContainText('canvas-lore.wacz')
    await expect(embedNode.getByRole('link', { name: 'Open file' })).toHaveAttribute(
      'href',
      'https://example.com/canvas-lore.wacz',
    )
  })

  test('uploads from an empty canvas embed into the Assets folder and embeds the file', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueCanvasName('Upload Embed Host', testInfo)
    await createFreshCanvasForTest(page, campaignName, hostName)
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')

    const embedNode = await createEmptyEmbedFromPaneMenu(page)
    const fileChooserPromise = page.waitForEvent('filechooser')
    await embedNode.getByRole('button', { name: 'Upload' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(imageFilePath)

    await expect(sidebarLink(page, 'Assets')).toBeVisible({ timeout: 15_000 })
    await expectFileInAssetsFolder(page)
    await expect(embedNode.getByRole('img', { name: imageFileName })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('rejects dropping the current canvas onto its own empty embed', async ({
    page,
  }, testInfo) => {
    const hostName = uniqueCanvasName('Canvas Self Embed Host', testInfo)
    await createFreshCanvasForTest(page, campaignName, hostName)
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')

    const embedNode = await createEmptyEmbedFromPaneMenu(page)
    await dragSidebarItemToCanvasNode(page, hostName, embedNode)

    await expect(embedNode.getByTestId('embed-empty-state')).toBeVisible()
    await expect
      .poll(async () => {
        const snapshot = await getCanvasRuntimeSnapshot(page)
        const embed = snapshot.nodes.find((node) => node.type === 'embed')
        return embed?.data?.target
      })
      .toEqual({ kind: 'empty' })
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
  await expect(getCanvasEdgeById(page, 'embed-child-edge')).toHaveCount(1)
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
  await expect(page.getByRole('heading', { name: 'Create New' })).toBeVisible({ timeout: 10000 })
}

async function dragSidebarItemToCanvas(
  page: Page,
  itemName: string,
  target: { xRatio: number; yRatio: number },
) {
  const item = selectableSidebarRow(page, itemName)
  await expect(item).toBeVisible()
  const paneBox = await getCanvasPane(page).boundingBox()
  if (!paneBox) {
    throw new Error('Canvas pane is not visible')
  }

  await item.dragTo(getCanvasPane(page), {
    targetPosition: {
      x: paneBox.width * target.xRatio,
      y: paneBox.height * target.yRatio,
    },
  })
}

async function openPaneNewMenu(page: Page, target: { xRatio: number; yRatio: number }) {
  const pane = getCanvasPane(page)
  const paneBox = await pane.boundingBox()
  if (!paneBox) throw new Error('Canvas pane is not visible')
  await pane.evaluate((element, position) => {
    const box = element.getBoundingClientRect()
    element.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width * position.xRatio,
        clientY: box.top + box.height * position.yRatio,
        button: 2,
      }),
    )
  }, target)
  await expect(page.getByRole('menu')).toBeVisible()
  await page.getByRole('menuitem', { name: 'New...' }).hover()
}

async function createEmptyEmbedFromPaneMenu(page: Page) {
  await openPaneNewMenu(page, { xRatio: 0.5, yRatio: 0.5 })
  await page.getByRole('menuitem', { name: 'Embed' }).click()
  await expect.poll(() => getCanvasNodesByType(page, 'embed').count()).toBe(1)
  const embedNode = getCanvasNodesByType(page, 'embed').first()
  await expect(embedNode.getByTestId('embed-empty-state')).toBeVisible({ timeout: 10_000 })
  return embedNode
}

async function dragSidebarItemToCanvasNode(page: Page, itemName: string, target: Locator) {
  const item = selectableSidebarRow(page, itemName)
  await expect(item).toBeVisible({ timeout: 10_000 })
  await item.dragTo(target)
}

async function expectFileInAssetsFolder(page: Page) {
  const assetsSlug = await getItemSlugFromSidebarLink(page, 'Assets')
  const fileSlug = await getItemSlugFromSidebarLink(page, imageFileName)
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const assets = await getSidebarItemBySlug({ campaignId, slug: assetsSlug })
  const file = await getSidebarItemBySlug({ campaignId, slug: fileSlug })
  expect(file.parentId).toBe(assets._id)
}

async function getItemSlugFromSidebarLink(page: Page, itemName: string) {
  const link = sidebarLink(page, itemName)
  await expect(link).toBeVisible({ timeout: 15_000 })
  const href = await link.getAttribute('href')
  const slug = href ? new URL(href, page.url()).searchParams.get('item') : null
  if (!slug) throw new Error(`Unable to resolve sidebar item slug for ${itemName}`)
  return slug
}

function createOnePixelPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l0S4YwAAAABJRU5ErkJggg==',
    'base64',
  )
}
