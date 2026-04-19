import { expect } from '@playwright/test'
import { openItem } from './sidebar-helpers'
import type { Locator, Page } from '@playwright/test'

export interface CanvasPoint {
  x: number
  y: number
}

export const DEFAULT_CANVAS_NAME = 'Untitled Canvas'

interface CanvasDragOptions {
  steps?: number
}

const TOOL_NAME_PATTERNS: Record<string, RegExp> = {
  Pointer: /^(Pointer|Select)$/i,
  Panning: /^(Panning|Hand)$/i,
  'Lasso select': /^Lasso select$/i,
  Draw: /^Draw$/i,
  Eraser: /^(Eraser|Erase)$/i,
  Text: /^(Text|Add text node)$/i,
  'Post-it': /^(Post-it|Add sticky note)$/i,
  Rectangle: /^Rectangle$/i,
}

const VIEWPORT_CONTROL_PATTERNS = {
  zoomIn: /^Zoom in$/i,
  zoomOut: /^Zoom out$/i,
  fitZoom: /^(Fit zoom|Fit view)$/i,
  undo: /^Undo$/i,
  redo: /^Redo$/i,
}

export async function createCanvas(page: Page, name: string = DEFAULT_CANVAS_NAME) {
  const prevUrl = page.url()
  await page.getByRole('button', { name: /canvas.*collaborative whiteboard/i }).click()

  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(page).not.toHaveURL(prevUrl, { timeout: 10000 })
  await expect(textbox).toHaveValue(name, { timeout: 10000 })

  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible({
    timeout: 10000,
  })
  await expect(getCanvasSurface(page)).toBeVisible({ timeout: 10000 })
}

export async function openCanvas(page: Page, name: string) {
  await openItem(page, name)
  await expect(getCanvasSurface(page)).toBeVisible({ timeout: 10000 })
}

export function getCanvasSurface(page: Page) {
  return page
    .locator('[data-testid="canvas-surface"], [aria-label="Canvas surface"], .react-flow')
    .first()
}

export function getCanvasPane(page: Page) {
  return getCanvasSurface(page).locator('.react-flow__pane')
}

export function getCanvasPendingSelectionStatus(page: Page) {
  return page.getByRole('status').filter({ hasText: /^Selecting \d+ node/ })
}

export function getCanvasMarqueeOverlay(page: Page) {
  return page.getByTestId('canvas-marquee-overlay')
}

export function getCanvasLassoOverlay(page: Page) {
  return page.getByTestId('canvas-lasso-overlay')
}

export function getCanvasNodes(page: Page) {
  return page.getByTestId('canvas-node')
}

export function getCanvasToolButton(page: Page, label: keyof typeof TOOL_NAME_PATTERNS) {
  return page.getByRole('button', {
    name: TOOL_NAME_PATTERNS[label] ?? new RegExp(`^${label}$`, 'i'),
  })
}

export function getCommittedSelectedCanvasNodes(page: Page) {
  return page.locator('[data-testid="canvas-node"][data-node-selected="true"]')
}

export function getVisuallySelectedCanvasNodes(page: Page) {
  return page.locator('[data-testid="canvas-node"][data-node-visual-selected="true"]')
}

export function getCanvasNodesByType(page: Page, nodeType: string) {
  return page.locator(`[data-testid="canvas-node"][data-node-type="${nodeType}"]`)
}

export function getCanvasPendingPreviewActiveNodes(page: Page) {
  return page.locator('[data-testid="canvas-node"][data-node-pending-preview-active="true"]')
}

export function getCanvasNodeById(page: Page, nodeId: string) {
  return page.locator(`[data-testid="canvas-node"][data-node-id="${nodeId}"]`)
}

async function getCanvasNodeIdsForLocator(locator: Locator) {
  return locator.evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-node-id'))
      .filter((nodeId): nodeId is string => nodeId !== null),
  )
}

export async function getCanvasNodeIds(page: Page) {
  return getCanvasNodeIdsForLocator(getCanvasNodes(page))
}

export async function getCanvasPendingSelectionNodeIds(page: Page) {
  return getCanvasNodeIdsForLocator(
    page.locator('[data-testid="canvas-node"][data-node-pending-selected="true"]'),
  )
}

export async function getCanvasNodeBoundingBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Canvas node is not visible')
  }

  return box
}

export function getViewportControls(page: Page) {
  return {
    zoomIn: page.getByRole('button', { name: VIEWPORT_CONTROL_PATTERNS.zoomIn }),
    zoomOut: page.getByRole('button', { name: VIEWPORT_CONTROL_PATTERNS.zoomOut }),
    fitZoom: page.getByRole('button', { name: VIEWPORT_CONTROL_PATTERNS.fitZoom }),
    undo: page.getByRole('button', { name: VIEWPORT_CONTROL_PATTERNS.undo }),
    redo: page.getByRole('button', { name: VIEWPORT_CONTROL_PATTERNS.redo }),
  }
}

export async function selectCanvasTool(page: Page, label: string) {
  const button = getCanvasToolButton(page, label)
  await button.click()
}

export async function clickCanvasAt(page: Page, point: CanvasPoint) {
  const absolutePoint = await resolveCanvasPoint(page, point)
  await page.mouse.click(absolutePoint.x, absolutePoint.y)
}

export async function startCanvasPointerGesture(page: Page, point: CanvasPoint) {
  const absolutePoint = await resolveCanvasPoint(page, point)
  await page.mouse.move(absolutePoint.x, absolutePoint.y)
  await page.mouse.down()
}

export async function moveCanvasPointer(
  page: Page,
  point: CanvasPoint,
  { steps = 10 }: CanvasDragOptions = {},
) {
  const absolutePoint = await resolveCanvasPoint(page, point)
  await page.mouse.move(absolutePoint.x, absolutePoint.y, { steps })
}

export async function endCanvasPointerGesture(page: Page) {
  await page.mouse.up()
}

export async function dragOnCanvas(
  page: Page,
  start: CanvasPoint,
  end: CanvasPoint,
  { steps = 12 }: CanvasDragOptions = {},
) {
  await startCanvasPointerGesture(page, start)
  await moveCanvasPointer(page, end, { steps })
  await endCanvasPointerGesture(page)
}

export async function lassoOnCanvas(
  page: Page,
  points: Array<CanvasPoint>,
  { steps = 8 }: CanvasDragOptions = {},
) {
  if (points.length < 2) {
    throw new Error('lassoOnCanvas requires at least two points')
  }

  await startCanvasPointerGesture(page, points[0])
  for (let index = 1; index < points.length; index += 1) {
    await moveCanvasPointer(page, points[index], { steps })
  }
  await endCanvasPointerGesture(page)
}

export async function clickCanvasNode(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Canvas node is not visible')
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

export async function dragCanvasNode(page: Page, locator: Locator, delta: CanvasPoint) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Canvas node is not visible')
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 12 })
  await page.mouse.up()
}

export async function resizeCanvasNode(
  page: Page,
  locator: Locator,
  handlePosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  delta: CanvasPoint,
) {
  const handle = locator.getByTestId(`canvas-node-resize-handle-${handlePosition}`)
  const box = await handle.boundingBox()
  if (!box) {
    throw new Error(`Resize handle ${handlePosition} is not visible`)
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 })
  await page.mouse.up()
}

async function resolveCanvasPoint(page: Page, point: CanvasPoint) {
  const pane = getCanvasPane(page)
  await expect(pane).toBeVisible({ timeout: 10000 })
  const box = await pane.boundingBox()
  if (!box) {
    throw new Error('Canvas pane is not visible')
  }

  return {
    x: box.x + point.x,
    y: box.y + point.y,
  }
}
