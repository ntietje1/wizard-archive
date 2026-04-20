import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  clickCanvasAt,
  clickCanvasNode,
  createCanvas,
  DEFAULT_CANVAS_NAME,
  getCanvasPane,
  getCanvasEdges,
  getCanvasNodeHandle,
  dragOnCanvas,
  getCanvasNodesByType,
  getCanvasSurface,
  getCanvasToolButton,
  getCommittedSelectedCanvasNodes,
  getViewportControls,
  openCanvas,
  selectCanvasTool,
} from './helpers/canvas-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('Canvas Basics')
const canvasName = DEFAULT_CANVAS_NAME
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
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
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
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
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createCanvas(page, canvasName)

    await expect(getCanvasToolButton(page, 'Pointer')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Lasso select')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Draw')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Text')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Post-it')).toBeVisible()
    await expect(getCanvasToolButton(page, 'Rectangle')).toBeVisible()

    const viewport = getViewportControls(page)
    await expect(viewport.zoomIn).toBeVisible()
    await expect(viewport.zoomOut).toBeVisible()
    await expect(viewport.fitZoom).toBeVisible()
    await expect(viewport.undo).toBeVisible()
    await expect(viewport.redo).toBeVisible()

    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(canvasName)
    await expect(getCanvasSurface(page)).toBeVisible()
  })

  test('place and edit text, sticky, and rectangle nodes', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 120, y: 120 })
    const textInput = page.getByLabel('Text node content')
    await expect(textInput).toBeVisible()
    await textInput.fill('Canvas text')
    await textInput.press('Enter')

    await selectCanvasTool(page, 'Post-it')
    await clickCanvasAt(page, { x: 320, y: 120 })
    const stickyInput = page.getByLabel('Sticky note text')
    await expect(stickyInput).toBeVisible()
    await stickyInput.fill('Sticky body')
    await stickyInput.press(`${mod}+Enter`)

    await selectCanvasTool(page, 'Rectangle')
    await dragOnCanvas(page, { x: 120, y: 260 }, { x: 280, y: 360 })
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)

    await selectCanvasTool(page, 'Rectangle')
    // A 6px drag from {x:320,y:260} to {x:326,y:266} stays below the rectangle minimum size
    // threshold, so the gesture should create zero additional rectangle nodes.
    await dragOnCanvas(page, { x: 320, y: 260 }, { x: 326, y: 266 })
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)

    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(1)
    await expect.poll(() => getCanvasNodesByType(page, 'sticky').count()).toBe(1)
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Sticky body', { exact: true })).toBeVisible()

    await page.reload()
    await expect(getCanvasSurface(page)).toBeVisible()
    await expect(page.getByText('Canvas text', { exact: true })).toBeVisible()
    await expect(page.getByText('Sticky body', { exact: true })).toBeVisible()
    await expect.poll(() => getCanvasNodesByType(page, 'rectangle').count()).toBe(1)
  })

  test('draw, select, clear, delete, and undo or redo', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Draw')
    await dragOnCanvas(page, { x: 430, y: 100 }, { x: 540, y: 200 })
    await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(1)

    await page.reload()
    await expect(getCanvasSurface(page)).toBeVisible()
    await selectCanvasTool(page, 'Pointer')
    const stickyNode = getCanvasNodesByType(page, 'sticky').first()
    await clickCanvasNode(page, stickyNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)

    await clickCanvasAt(page, { x: 700, y: 520 })
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(0)

    const textNode = getCanvasNodesByType(page, 'text').first()
    await clickCanvasNode(page, textNode)
    await expect.poll(() => getCommittedSelectedCanvasNodes(page).count()).toBe(1)
    await page.keyboard.press('Delete')
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(0)

    const viewport = getViewportControls(page)
    await viewport.undo.click()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(1)

    await viewport.redo.click()
    await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(0)
  })

  test('create an edge from one node handle to another', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Text')
    await clickCanvasAt(page, { x: 120, y: 420 })
    const textInput = page.getByLabel('Text node content')
    await expect(textInput).toBeVisible()
    await textInput.fill('Edge source')
    await textInput.press('Enter')

    await selectCanvasTool(page, 'Post-it')
    await clickCanvasAt(page, { x: 360, y: 420 })
    const stickyInput = page.getByLabel('Sticky note text')
    await expect(stickyInput).toBeVisible()
    await stickyInput.fill('Edge target')
    await stickyInput.press(`${mod}+Enter`)

    await selectCanvasTool(page, 'Pointer')
    const sourceNode = getCanvasNodesByType(page, 'text').last()
    const targetNode = getCanvasNodesByType(page, 'sticky').last()
    const edgeCountBefore = await getCanvasEdges(page).count()
    await clickCanvasNode(page, sourceNode)

    const sourceHandle = getCanvasNodeHandle(sourceNode, 'right')
    const targetHandle = getCanvasNodeHandle(targetNode, 'left')
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await targetHandle.boundingBox()

    if (!sourceBox || !targetBox) {
      throw new Error('Canvas connection handles are not visible')
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 12,
    })

    await expect
      .poll(async () => (await targetHandle.getAttribute('class')) ?? '')
      .toContain('connectionindicator')

    await page.mouse.up()
    await expect.poll(() => getCanvasEdges(page).count()).toBe(edgeCountBefore + 1)
  })

  test('closing the canvas context menu on left mouse down can continue into a node drag', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    await selectCanvasTool(page, 'Post-it')
    await clickCanvasAt(page, { x: 520, y: 420 })
    const stickyInput = page.getByLabel('Sticky note text')
    await expect(stickyInput).toBeVisible()
    await stickyInput.fill('Drag after context menu')
    await stickyInput.press(`${mod}+Enter`)

    await selectCanvasTool(page, 'Pointer')
    const stickyNode = page
      .locator('[data-testid="canvas-node"][data-node-type="sticky"]')
      .filter({ has: page.getByText('Drag after context menu', { exact: true }) })
      .first()
    await clickCanvasNode(page, stickyNode)

    const before = await stickyNode.boundingBox()
    if (!before) {
      throw new Error('Sticky node is not visible before context menu drag test')
    }

    const dragStartPoint = {
      x: before.x + 24,
      y: before.y + 24,
    }

    await page.mouse.click(dragStartPoint.x, dragStartPoint.y, {
      button: 'right',
    })
    await expect(page.getByRole('menu')).toBeVisible()

    await page.mouse.move(dragStartPoint.x, dragStartPoint.y)
    await page.mouse.down()
    await page.mouse.move(
      dragStartPoint.x + CONTEXT_MENU_DRAG_DISTANCE_X,
      dragStartPoint.y + CONTEXT_MENU_DRAG_DISTANCE_Y,
      {
        steps: 12,
      },
    )
    await page.mouse.up()

    await expect(page.getByRole('menu')).not.toBeVisible()

    await expect
      .poll(async () => {
        const box = await stickyNode.boundingBox()
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

  test('canvas context menu stays open while hovering paste and reorder items', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openCanvas(page, canvasName)

    const pane = getCanvasPane(page)
    const paneBox = await pane.boundingBox()
    if (!paneBox) {
      throw new Error('Canvas pane is not visible before context menu hover test')
    }

    await selectCanvasTool(page, 'Pointer')
    await page.mouse.click(paneBox.x + 80, paneBox.y + 80, { button: 'right' })

    const pasteItem = page.getByRole('menuitem', { name: 'Paste' })
    await expect(pasteItem).toBeVisible()
    const pasteBox = await pasteItem.boundingBox()
    if (!pasteBox) {
      throw new Error('Paste menu item is not visible during context menu hover test')
    }
    await page.mouse.move(pasteBox.x + pasteBox.width / 2, pasteBox.y + pasteBox.height / 2)
    await page.mouse.move(paneBox.x + 220, paneBox.y + 80)
    await expect(pasteItem).toBeVisible()

    await page.mouse.click(paneBox.x + 240, paneBox.y + 240)

    await selectCanvasTool(page, 'Post-it')
    await clickCanvasAt(page, { x: 640, y: 180 })
    const stickyInput = page.getByLabel('Sticky note text')
    await expect(stickyInput).toBeVisible()
    await stickyInput.fill('Context menu reorder hover')
    await stickyInput.press(`${mod}+Enter`)

    await selectCanvasTool(page, 'Pointer')
    const stickyNode = page
      .locator('[data-testid="canvas-node"][data-node-type="sticky"]')
      .filter({ has: page.getByText('Context menu reorder hover', { exact: true }) })
      .first()

    const stickyBox = await stickyNode.boundingBox()
    if (!stickyBox) {
      throw new Error('Sticky node is not visible before reorder hover test')
    }

    await page.mouse.click(stickyBox.x + stickyBox.width / 2, stickyBox.y + stickyBox.height / 2, {
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
