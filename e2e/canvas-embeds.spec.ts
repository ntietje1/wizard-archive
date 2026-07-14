import fs from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'
import { expect, test } from '@playwright/test'
import { createCanvasDocumentDoc } from '@wizard-archive/editor/canvas/document-contract'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { testNoteBlockId } from 'shared/test/note-block-id'
import { api } from 'convex/_generated/api'
import { makeYjsUpdateWithBlocks } from '../convex/_test/yjs.helper'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createMap } from './helpers/map-helpers'
import { createNote, selectableSidebarRow, sidebarItem } from './helpers/sidebar-helpers'
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
  getCanvasTextEditors,
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
  createE2EConvexClient,
  getCampaignIdFromRoute,
  getCampaignRouteFromUrl,
  getSidebarItemByName,
  getSidebarItemBySlug,
} from './helpers/convex-helpers'
import type { Id } from 'convex/_generated/dataModel'
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
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath)

    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
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

    await page.goto('/campaigns', { waitUntil: 'commit' })
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
      resourceId: sourceCanvasId,
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

  test('starts custom block drags in regular and embedded notes and moves selected text without a canvas drop rejection', async ({
    page,
  }, testInfo) => {
    const noteName = uniqueCanvasName('Block Drag Note', testInfo)
    const hostName = uniqueCanvasName('Block Drag Host', testInfo)
    const firstBlockText = uniqueCanvasName('First embedded block', testInfo)
    const secondBlockText = uniqueCanvasName('Second embedded block', testInfo)

    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
    const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
    const note = await getSidebarItemByName({ campaignId, name: noteName })
    const client = await createE2EConvexClient()
    await client.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId,
      documentId: note.id,
      update: makeYjsUpdateWithBlocks([
        paragraphBlock('embedded-note-drag-first', firstBlockText),
        paragraphBlock('embedded-note-drag-second', secondBlockText),
      ]),
    })
    await client.action(api.notes.actions.persistNoteBlocks, {
      campaignId,
      documentId: note.id,
    })

    const regularNoteSecondBlock = page
      .locator('.note-editor-core-surface [data-node-type="blockContainer"]')
      .filter({ hasText: secondBlockText })
      .first()
    await expect(regularNoteSecondBlock).toBeVisible({ timeout: 15_000 })
    await regularNoteSecondBlock.hover()
    const regularNoteDragHandle = page.getByTestId('block-drag-handle-button')
    await expect(regularNoteDragHandle).toBeVisible()
    await regularNoteDragHandle.click()
    await expect(page.getByTestId('block-drag-handle-menu')).toBeVisible()
    await expectNativeBlockDragStart(page, regularNoteDragHandle, secondBlockText)
    await expect(page.getByTestId('block-drag-handle-menu')).not.toBeVisible()

    await createFreshCanvasForTest(page, campaignName, hostName)
    await clearCanvasViaRuntime(page)
    await selectCanvasTool(page, 'Pointer')
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embedded-note-block-drag',
      resourceId: note.id,
      position: { x: 620, y: 180 },
      width: 520,
      height: 360,
    })

    const embedNode = getCanvasNodeById(page, 'embedded-note-block-drag')
    const embeddedWrapper = page.getByTestId('embed-note-content-wrapper')
    await expect(embeddedWrapper).toContainText(secondBlockText, { timeout: 15_000 })
    await embedNode.dblclick()
    await expect(embeddedWrapper).toHaveAttribute('data-embedded-note-mode', 'editable', {
      timeout: 15_000,
    })

    const firstBlock = embeddedWrapper
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: firstBlockText })
      .first()
    const secondBlock = embeddedWrapper
      .locator('[data-node-type="blockContainer"]')
      .filter({ hasText: secondBlockText })
      .first()
    await secondBlock.hover()
    const dragHandle = page.getByTestId('block-drag-handle-button')
    await expect(dragHandle).toBeVisible()
    await expectNativeBlockDragStart(page, dragHandle, secondBlockText)
    await secondBlock.hover()
    await expect(dragHandle).toBeVisible()
    await dispatchBlockDrag(page, dragHandle, firstBlock)
    await page.waitForTimeout(100)

    await expect
      .poll(async () => {
        const text = (await embeddedWrapper.textContent()) ?? ''
        return text.indexOf(secondBlockText) < text.indexOf(firstBlockText)
      })
      .toBe(true)
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Cannot drop here' }),
    ).toHaveCount(0)

    const selectedText = await dragSelectedText(page, firstBlockText, secondBlockText)

    await expect(secondBlock).toContainText(selectedText)
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Cannot drop here' }),
    ).toHaveCount(0)
  })

  test('keeps embedded canvas children render-only for selection, editing, menus, and wheel', async ({
    page,
  }, testInfo) => {
    const { hostName, sourceCanvasId } = await createEmbeddedCanvasFixture(page, testInfo)
    await openHostCanvas(page, hostName)
    await seedCanvasEmbedNodeViaRuntime(page, {
      id: 'embed-source',
      resourceId: sourceCanvasId,
      position: { x: 220, y: 180 },
      width: 420,
      height: 300,
    })
    const embedNode = getCanvasNodeById(page, 'embed-source')
    await expect(getEmbeddedCanvasPreview(page)).toBeVisible({ timeout: 15_000 })

    await selectCanvasTool(page, 'Pointer')
    await clickEmbeddedPreview(page, { x: 180, y: 120 }, { clickCount: 2 })
    await page.keyboard.type('should not edit embedded child')
    await expect(getCanvasTextEditors(page)).toHaveCount(0)
    await expectCanvasRuntimeSelection(page, { nodeIds: ['embed-source'], edgeIds: [] })

    await clickEmbeddedPreview(page, { x: 180, y: 120 }, { button: 'right' })
    await expect(page.getByRole('menuitem', { exact: true, name: 'Open' })).toBeVisible()
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
      resourceId: sourceCanvasId,
      position: { x: 240, y: 180 },
      width: 360,
      height: 260,
    })

    const embedNode = getCanvasNodeById(page, 'embed-open-target')
    const box = await embedNode.boundingBox()
    if (!box) throw new Error('Embed node is not visible')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
    await expect(page.getByRole('menuitem', { exact: true, name: 'Open' })).toBeVisible()
    await page.getByRole('menuitem', { exact: true, name: 'Open' }).click()

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

    await expect(sidebarItem(page, 'Assets')).toBeVisible({ timeout: 15_000 })
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
  await persistCurrentCanvasSnapshot(page, sourceCanvasId)

  await createFreshCanvasForTest(page, campaignName, hostName)
  await clearCanvasViaRuntime(page)

  return { hostName, sourceCanvasId, sourceName }
}

async function persistCurrentCanvasSnapshot(page: Page, canvasId: Id<'sidebarItems'>) {
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const snapshot = await getCanvasRuntimeSnapshot(page)
  const doc = createCanvasDocumentDoc({ nodes: snapshot.nodes, edges: snapshot.edges })
  try {
    const client = await createE2EConvexClient()
    await client.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId,
      documentId: canvasId,
      update: toArrayBuffer(Y.encodeStateAsUpdate(doc)),
    })
    await expect
      .poll(async () => {
        const updates = await client.query(api.yjsSync.queries.getUpdates, {
          campaignId,
          documentId: canvasId,
          afterSeq: -1,
          paginationOpts: { cursor: null, numItems: 1 },
        })
        return updates.page.length
      })
      .toBeGreaterThan(0)
  } finally {
    doc.destroy()
  }
}

function toArrayBuffer(update: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer
}

async function openHostCanvas(page: Page, hostName: string) {
  await page.goto('/campaigns', { waitUntil: 'commit' })
  await navigateToCampaign(page, campaignName)
  await openCanvas(page, hostName)
  await waitForCanvasRuntime(page)
  await clearCanvasViaRuntime(page)
}

function uniqueCanvasName(prefix: string, testInfo: TestInfo) {
  return `${prefix} ${testInfo.workerIndex}-${testInfo.retry}-${Date.now()}`
}

function paragraphBlock(id: string, text: string): PartialNoteBlock {
  return {
    id: testNoteBlockId(id),
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  }
}

async function dragSelectedText(page: Page, sourceText: string, targetText: string) {
  const points = await page.evaluate(
    ({ sourceText: source, targetText: target }) => {
      const findTextNode = (text: string) => {
        const editor = document.querySelector('.note-editor-core-surface .bn-editor')
        if (!editor) throw new Error('Embedded note editor not found')
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
          const value = node.textContent ?? ''
          const offset = value.indexOf(text)
          if (offset >= 0) return { node, offset }
          node = walker.nextNode()
        }
        throw new Error(`Text not found: ${text}`)
      }
      const sourceNode = findTextNode(source)
      const targetNode = findTextNode(target)
      const sourceRange = document.createRange()
      sourceRange.setStart(sourceNode.node, sourceNode.offset)
      sourceRange.setEnd(sourceNode.node, sourceNode.offset + source.length)
      const sourceRect = sourceRange.getBoundingClientRect()
      const targetRange = document.createRange()
      targetRange.setStart(targetNode.node, targetNode.offset)
      targetRange.setEnd(targetNode.node, targetNode.offset + target.length)
      const targetRect = targetRange.getBoundingClientRect()
      return {
        drag: {
          x: sourceRect.left + sourceRect.width / 2,
          y: sourceRect.top + sourceRect.height / 2,
        },
        selectEnd: { x: sourceRect.right - 2, y: sourceRect.top + sourceRect.height / 2 },
        selectStart: { x: sourceRect.left + 2, y: sourceRect.top + sourceRect.height / 2 },
        target: { x: targetRect.right - 2, y: targetRect.top + targetRect.height / 2 },
      }
    },
    { sourceText, targetText },
  )

  await page.mouse.move(points.selectStart.x, points.selectStart.y)
  await page.mouse.down()
  await page.mouse.move(points.selectEnd.x, points.selectEnd.y, { steps: 12 })
  await page.mouse.up()
  const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '')
  if (!selectedText) throw new Error('Expected text to be selected before dragging')

  await page.mouse.move(points.drag.x, points.drag.y)
  await page.mouse.down()
  await page.mouse.move(points.drag.x + 10, points.drag.y, { steps: 4 })
  await page.mouse.move(points.target.x, points.target.y, { steps: 16 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  return selectedText
}

async function expectNativeBlockDragStart(
  page: Page,
  dragHandle: Locator,
  expectedPreviewText: string,
) {
  const bounds = await dragHandle.boundingBox()
  if (!bounds) throw new Error('Expected block drag handle geometry')

  const dragStarted = page.evaluate(() => {
    const dragImages: Array<{
      height: number
      opacity: string
      previewText: string
      width: number
      x: number
      y: number
    }> = []
    const setDragImage = Reflect.get(
      DataTransfer.prototype,
      'setDragImage',
    ) as DataTransfer['setDragImage']
    DataTransfer.prototype.setDragImage = function (image, x, y) {
      const rect = image.getBoundingClientRect()
      dragImages.push({
        height: rect.height,
        opacity: getComputedStyle(image).opacity,
        previewText: image.textContent ?? '',
        width: rect.width,
        x,
        y,
      })
      Reflect.apply(setDragImage, this, [image, x, y])
    }

    return new Promise<{
      connected: boolean
      dragImage: {
        height: number
        opacity: string
        previewText: string
        width: number
        x: number
        y: number
      } | null
      previewText: string
      types: Array<string>
    }>((resolve) => {
      window.addEventListener(
        'dragstart',
        (event) => {
          const dragEvent = event as DragEvent
          const types = [...(dragEvent.dataTransfer?.types ?? [])]
          const previewText = document.querySelector('.bn-drag-preview')?.textContent ?? ''
          dragEvent.preventDefault()
          window.setTimeout(() => {
            DataTransfer.prototype.setDragImage = setDragImage
            resolve({
              connected: event.target instanceof Element && event.target.isConnected,
              dragImage: dragImages.at(-1) ?? null,
              previewText,
              types,
            })
          }, 0)
        },
        { once: true },
      )
    })
  })
  const start = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x - 12, start.y)
  await page.mouse.up()

  const dragStart = await dragStarted
  expect(dragStart).toEqual({
    connected: true,
    dragImage: expect.objectContaining({
      opacity: '1',
      previewText: expect.stringContaining(expectedPreviewText),
    }),
    previewText: expect.stringContaining(expectedPreviewText),
    types: expect.arrayContaining(['blocknote/html', 'application/x-wizard-archive-internal-drag']),
  })
  expect(dragStart.dragImage?.height).toBeGreaterThan(0)
  expect(dragStart.dragImage?.width).toBeGreaterThan(0)
  expect(dragStart.dragImage?.x).toBeGreaterThanOrEqual(0)
  expect(dragStart.dragImage?.y).toBeGreaterThanOrEqual(0)
  await dragHandle.dispatchEvent('dragend')
}

async function dispatchBlockDrag(page: Page, dragHandle: Locator, targetBlock: Locator) {
  const sourceBounds = await dragHandle.boundingBox()
  const targetBounds = await targetBlock.boundingBox()
  if (!sourceBounds || !targetBounds) throw new Error('Expected block drag geometry')

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await dragHandle.dispatchEvent('dragstart', {
    clientX: sourceBounds.x + sourceBounds.width / 2,
    clientY: sourceBounds.y + sourceBounds.height / 2,
    dataTransfer,
  })
  const target = {
    clientX: targetBounds.x + 16,
    clientY: targetBounds.y + 1,
    dataTransfer,
  }
  await targetBlock.dispatchEvent('dragover', target)
  await targetBlock.dispatchEvent('drop', target)
  await dragHandle.dispatchEvent('dragend', { dataTransfer })
  await dataTransfer.dispose()
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
  await page
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('button', { name: 'New', exact: true })
    .click()
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
  await page.getByRole('menuitem', { exact: true, name: 'New...' }).click()
  await expect(page.getByRole('menuitem', { exact: true, name: 'Embed' })).toBeVisible()
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
  const assetsSlug = await getItemSlugFromSidebarItem(page, 'Assets')
  const fileSlug = await getItemSlugFromSidebarItem(page, imageFileName)
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  const assets = await getSidebarItemBySlug({ campaignId, slug: assetsSlug })
  const file = await getSidebarItemBySlug({ campaignId, slug: fileSlug })
  expect(file.parentId).toBe(assets.id)
}

async function getItemSlugFromSidebarItem(page: Page, itemName: string) {
  await expect(sidebarItem(page, itemName)).toBeVisible({ timeout: 15_000 })
  const { dmUsername, campaignSlug } = getCampaignRouteFromUrl(page.url())
  const campaignId = await getCampaignIdFromRoute({ dmUsername, slug: campaignSlug })
  return (await getSidebarItemByName({ campaignId, name: itemName })).slug
}

function createOnePixelPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/l0S4YwAAAABJRU5ErkJggg==',
    'base64',
  )
}
