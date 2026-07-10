import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clickCanvasNode,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  getCanvasPane,
  getCanvasEdges,
  getCanvasNodeHandle,
  dragCanvasNode,
  dragOnCanvas,
  getCanvasNodesByType,
  getCanvasSurface,
  getCanvasTextEditors,
  getCanvasToolButton,
  getCommittedSelectedCanvasNodes,
  getNewCanvasTextEditor,
  getViewportControls,
  waitForCanvasSurface,
  openCanvas,
  openCanvasNodeContextMenu,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('Canvas Basics')
const canvasName = DEFAULT_CANVAS_NAME
const CONTEXT_MENU_DRAG_DISTANCE_X = 120
const CONTEXT_MENU_DRAG_DISTANCE_Y = 60
// Closing the menu on left-down consumes part of the first drag step in CI, so the observed
// horizontal delta settles closer to two-thirds of the commanded drag while vertical movement
// consistently lands around half of the commanded distance.
const CONTEXT_MENU_DRAG_THRESHOLD_X = Math.round(CONTEXT_MENU_DRAG_DISTANCE_X * 0.67)
const CONTEXT_MENU_DRAG_THRESHOLD_Y = Math.round(CONTEXT_MENU_DRAG_DISTANCE_Y * 0.5)

test.describe.serial('canvas basics', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch (error) {
      console.debug('Failed to delete canvas basics campaign during teardown', {
        campaignName,
        error,
      })
    }
    await page.close()
    await context.close()
  })

  test('create and reopen a canvas with toolbar and viewport chrome', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)

    await expect(getCanvasToolButton(page, 'Pointer')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Lasso select')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Draw')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Text')).toBeVisible()

    const viewport = getViewportControls(page)
    await expect(viewport.zoomIn).toBeVisible()
    await expect(viewport.zoomOut).toBeVisible()
    await expect(viewport.fitZoom).toBeVisible()
    await expect(viewport.undo).toBeVisible()
    await expect(viewport.redo).toBeVisible()

    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(canvasName)
    await expect(getCanvasSurface(page)).toBeVisible({ timeout: 45_000 })
  })

  test('place and edit click-created and drag-created text nodes', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    const textEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 120, y: 120 })
    const textInput = await getNewCanvasTextEditor(page, textEditorCount)
    await expect(textInput).toBeVisible()
    await fillCanvasTextEditor(textInput, 'Canvas text')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Text')
    const secondTextEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 320, y: 120 })
    const secondTextInput = await getNewCanvasTextEditor(page, secondTextEditorCount)
    await expect(secondTextInput).toBeVisible()
    await fillCanvasTextEditor(secondTextInput, 'Second text')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Text')
    const draggedTextEditorCount = await getCanvasTextEditors(page).count()
    await dragOnCanvas(page, { x: 120, y: 260 }, { x: 280, y: 360 })
    const draggedTextInput = await getNewCanvasTextEditor(page, draggedTextEditorCount)
    await expect(draggedTextInput).toBeVisible()
    await fillCanvasTextEditor(draggedTextInput, 'Dragged text')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Text')
    const secondDraggedTextEditorCount = await getCanvasTextEditors(page).count()
    await dragOnCanvas(page, { x: 340, y: 260 }, { x: 500, y: 420 })
    const secondDraggedTextInput = await getNewCanvasTextEditor(page, secondDraggedTextEditorCount)
    await expect(secondDraggedTextInput).toBeVisible()
    await fillCanvasTextEditor(secondDraggedTextInput, 'Dragged second text')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(4)
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Second text', { exact: true })).toBeVisible()
    await expect(page.getByText('Dragged text', { exact: true })).toBeVisible()
    await expect(page.getByText('Dragged second text', { exact: true })).toBeVisible()

    await page.reload()
    await waitForCanvasSurface(page)
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Second text', { exact: true })).toBeVisible()
    await expect(page.getByText('Dragged text', { exact: true })).toBeVisible()
    await expect(page.getByText('Dragged second text', { exact: true })).toBeVisible()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(4)
  })

  test('draw, select, clear, delete, and undo or redo', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Draw')
    await dragOnCanvas(page, { x: 430, y: 100 }, { x: 540, y: 200 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)

    await page.reload()
    await waitForCanvasSurface(page)
    await selectCanvasTool(page, 'Pointer')
    const firstTextNode = getCanvasNodesByType(page, 'text').first()
    await clickCanvasNode(page, firstTextNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await clickCanvasAt(page, { x: 700, y: 520 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)

    const selectedTextNode = getCanvasNodesByType(page, 'text').first()
    await clickCanvasNode(page, selectedTextNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    const textCountBeforeDelete = await getCanvasNodesByType(page, 'text').count()
    await page.keyboard.press('Delete')
    await expect
      .poll(() => getCanvasNodesByType(page, 'text').count())
      .toBe(textCountBeforeDelete - 1)

    const viewport = getViewportControls(page)
    await viewport.undo.click()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(textCountBeforeDelete)

    await viewport.redo.click()
    await expect
      .poll(() => getCanvasNodesByType(page, 'text').count())
      .toBe(textCountBeforeDelete - 1)
  })

  test('create an edge from one node handle to another', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    const textEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 120, y: 420 })
    const textInput = await getNewCanvasTextEditor(page, textEditorCount)
    await expect(textInput).toBeVisible()
    await textInput.fill('Edge source')
    await textInput.press('Escape')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Text')
    const targetTextEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 620, y: 420 })
    const targetTextInput = await getNewCanvasTextEditor(page, targetTextEditorCount)
    await expect(targetTextInput).toBeVisible()
    await targetTextInput.fill('Edge target')
    await targetTextInput.press('Escape')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Edges')
    const sourceNode = page.getByTestId('canvas-node').filter({
      has: page.getByText('Edge source', { exact: true }),
    })
    const targetNode = page.getByTestId('canvas-node').filter({
      has: page.getByText('Edge target', { exact: true }),
    })
    const edgeCountBefore = await getCanvasEdges(page).count()

    const sourceHandle = getCanvasNodeHandle(sourceNode, 'right')
    const targetHandle = getCanvasNodeHandle(targetNode, 'left')
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()

    if (!sourceBox || !targetBox) {
      throw new Error('Canvas connection handles are not visible')
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    const targetCenter = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    }
    await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 12 })

    await page.mouse.up()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(edgeCountBefore + 1)
  })

  test('closing the canvas context menu on left mouse down allows a node drag', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    const textEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 520, y: 420 })
    const textInput = await getNewCanvasTextEditor(page, textEditorCount)
    await expect(textInput).toBeVisible()
    await textInput.fill('Drag after context menu')
    await textInput.press('Escape')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Pointer')
    const textNode = page
      .locator('[data-testid="canvas-node"][data-node-type="text"]')
      .filter({ has: page.getByText('Drag after context menu', { exact: true }) })
      .first()
    await clickCanvasNode(page, textNode)

    const before = await textNode.boundingBox()
    if (!before) {
      throw new Error('Text node is not visible before context menu drag test')
    }

    const dragStartPoint = {
      x: before.x + 24,
      y: before.y + 24,
    }

    await openCanvasNodeContextMenu(page, textNode, {
      positionRatio: { xRatio: 0.15, yRatio: 0.15 },
    })

    await page.mouse.click(dragStartPoint.x, dragStartPoint.y)
    await expect(page.getByRole('menu')).not.toBeVisible()
    await dragCanvasNode(page, textNode, {
      x: CONTEXT_MENU_DRAG_DISTANCE_X,
      y: CONTEXT_MENU_DRAG_DISTANCE_Y,
    })

    await expect
      .poll(async () => {
        const box = await textNode.boundingBox()
        if (!box) {
          return false
        }

        return (
          box.x - before.x >= CONTEXT_MENU_DRAG_THRESHOLD_X &&
          box.y - before.y >= CONTEXT_MENU_DRAG_THRESHOLD_Y
        )
      })
      .toBe(true)
  })

  test('canvas context menu stays open while hovering pane and reorder items', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    const pane = getCanvasPane(page)
    const paneBox = await pane.boundingBox()
    if (!paneBox) {
      throw new Error('Canvas pane is not visible before context menu hover test')
    }
    const emptyPanePoint = {
      x: paneBox.x + paneBox.width - 260,
      y: paneBox.y + paneBox.height - 180,
    }

    await selectCanvasTool(page, 'Pointer')
    await page.mouse.click(emptyPanePoint.x, emptyPanePoint.y, { button: 'right' })

    const paneMenu = page.getByRole('menu').first()
    await expect(paneMenu).toBeVisible()
    const paneMenuItem = paneMenu.getByRole('menuitem').first()
    await expect(paneMenuItem).toBeVisible()
    const paneMenuItemBox = await paneMenuItem.boundingBox()
    if (!paneMenuItemBox) {
      throw new Error('Pane menu item is not visible during context menu hover test')
    }
    await page.mouse.move(
      paneMenuItemBox.x + paneMenuItemBox.width / 2,
      paneMenuItemBox.y + paneMenuItemBox.height / 2,
    )
    await page.mouse.move(emptyPanePoint.x + 120, emptyPanePoint.y)
    await expect(paneMenu).toBeVisible()

    await page.mouse.click(paneBox.x + 240, paneBox.y + 240)

    await selectCanvasTool(page, 'Text')
    const textEditorCount = await getCanvasTextEditors(page).count()
    await clickCanvasAt(page, { x: 640, y: 180 })
    const textInput = await getNewCanvasTextEditor(page, textEditorCount)
    await expect(textInput).toBeVisible()
    await textInput.fill('Context menu reorder hover')
    await clickCanvasAt(page, { x: 40, y: 40 })

    await selectCanvasTool(page, 'Pointer')
    const textNode = page
      .locator('[data-testid="canvas-node"][data-node-type="text"]')
      .filter({ has: page.getByText('Context menu reorder hover', { exact: true }) })
      .first()

    const textBox = await textNode.boundingBox()
    if (!textBox) {
      throw new Error('Text node is not visible before reorder hover test')
    }

    await page.mouse.click(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2, {
      button: 'right',
    })

    const reorderItem = page.getByRole('menuitem', { name: 'Reorder' })
    await expect(reorderItem).toBeVisible()
    const reorderBox = await reorderItem.boundingBox()
    if (!reorderBox) {
      throw new Error('Reorder menu item is not visible during context menu hover test')
    }
    await page.mouse.move(reorderBox.x + reorderBox.width / 2, reorderBox.y + reorderBox.height / 2)
    await expect(page.getByRole('menuitem', { name: 'Send to back' })).toBeVisible()
  })
})

async function fillCanvasTextEditor(textInput: Locator, text: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await textInput.fill(text)
    const lastText = (await textInput.textContent({ timeout: 1000 }).catch(() => '')) ?? ''
    if (lastText.includes(text)) return
  }

  await expect(textInput).toContainText(text, { timeout: 5000 })
}
