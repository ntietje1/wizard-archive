import { expect } from '@playwright/test'
import { navigateToCampaign } from './campaign-helpers'
import { openItem } from './sidebar-helpers'
import type { Id } from 'convex/_generated/dataModel'
import type { CanvasDocumentEdge } from 'convex/canvases/validation'
import type { Locator, Page } from '@playwright/test'

export interface CanvasPoint {
  x: number
  y: number
}

export interface CanvasViewportState extends CanvasPoint {
  zoom: number
}

export interface CanvasRuntimeSnapshot {
  nodes: Array<{
    id: string
    type: string
    position: CanvasPoint
    width?: number
    height?: number
    data?: Record<string, unknown> | null
    zIndex?: number
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    type?: string
    style?: Record<string, unknown>
    zIndex?: number
  }>
  selection: { nodeIds: Array<string>; edgeIds: Array<string> }
  viewport: CanvasViewportState
}

export const DEFAULT_CANVAS_NAME = 'Untitled Canvas'

interface CanvasDragOptions {
  steps?: number
}

interface CanvasNodePositionRatio {
  xRatio: number
  yRatio: number
}

type ResizeHandlePosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'

const MODIFIER_SETTLE_DELAY_MS = 50

const TOOL_NAME_PATTERNS = {
  Pointer: /^(Pointer|Select)$/i,
  Panning: /^(Panning|Hand)$/i,
  'Lasso select': /^Lasso select$/i,
  Draw: /^Draw$/i,
  Edges: /^Edges$/i,
  Eraser: /^(Eraser|Erase)$/i,
  Text: /^(Text|Add text node)$/i,
} as const satisfies Record<string, RegExp>

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
  await expect(textbox).toBeVisible({ timeout: 10000 })
  if (name === DEFAULT_CANVAS_NAME) {
    await expect(textbox).toHaveValue(name, { timeout: 10000 })
  } else {
    await textbox.click()
    await textbox.fill(name)
    await textbox.press('Enter')
    await expect(textbox).toHaveValue(name, { timeout: 10000 })
  }

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
  return page.locator('[data-testid="canvas-surface"], [aria-label="Canvas surface"]').first()
}

export function getCanvasPane(page: Page) {
  return getCanvasSurface(page).locator('[data-testid="canvas-scene"]').first()
}

export function getCanvasViewport(page: Page) {
  return page.locator('[data-canvas-viewport="true"]').first()
}

export function getEmbeddedCanvasRoot(page: Page) {
  return page.getByTestId('embedded-canvas-root')
}

export function getEmbeddedCanvasPreview(page: Page) {
  return page.getByTestId('canvas-read-only-preview')
}

export function getCanvasSelectionResizeWrapper(page: Page) {
  return page.getByTestId('canvas-selection-resize-wrapper')
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

export function getCanvasDragSnapGuides(page: Page) {
  return page.getByTestId('canvas-drag-snap-guide')
}

export function getCanvasRemoteCursor(page: Page) {
  return page.getByTestId('canvas-remote-cursor')
}

export function getCanvasRemoteSelectionPreview(page: Page) {
  return page.getByTestId('canvas-remote-selection-preview')
}

export function getCanvasRemoteLassoPreview(page: Page) {
  return page.getByTestId('canvas-remote-lasso-preview')
}

export function getCanvasRemoteDrawPreview(page: Page) {
  return page.getByTestId('canvas-remote-draw-preview')
}

export function getCanvasNodes(page: Page) {
  return page.locator('[data-testid="canvas-node"]')
}

export function getCanvasEdges(page: Page) {
  return page.locator('[data-testid="canvas-edge"]')
}

export function getCanvasEdgeById(page: Page, edgeId: string) {
  return page.locator(`[data-testid="canvas-edge"][data-edge-id="${edgeId}"]`)
}

export function getCanvasToolButton(page: Page, label: keyof typeof TOOL_NAME_PATTERNS) {
  return page.getByRole('button', {
    name: TOOL_NAME_PATTERNS[label],
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

export function getCanvasNodeHandle(node: Locator, side: 'top' | 'right' | 'bottom' | 'left') {
  return node.getByTestId(`canvas-node-handle-${side}`)
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

export async function selectCanvasTool(page: Page, label: keyof typeof TOOL_NAME_PATTERNS) {
  const button = getCanvasToolButton(page, label)
  await button.click()
}

export async function enableCanvasRuntime(page: Page) {
  await page.addInitScript(() => {
    window.__WA_CANVAS_PERF__ = { enabled: true, entries: [] }
  })
}

export async function waitForCanvasRuntime(page: Page) {
  await page.waitForFunction(() => Boolean(window.__WA_CANVAS_PERF_RUNTIME__), null, {
    timeout: 10_000,
  })
}

export async function createFreshCanvasForTest(
  page: Page,
  campaignName: string,
  canvasName: string,
) {
  await page.goto('/campaigns')
  await navigateToCampaign(page, campaignName)
  await createCanvas(page, canvasName)
  await waitForCanvasRuntime(page)
}

export async function clearCanvasViaRuntime(page: Page) {
  await waitForCanvasRuntime(page)
  await page.evaluate(() => {
    window.__WA_CANVAS_PERF_RUNTIME__?.clearCanvas()
  })
  await expect.poll(() => getCanvasNodes(page).count()).toBe(0)
  await expect.poll(() => getCanvasEdges(page).count()).toBe(0)
}

export async function getCanvasRuntimeCanvasId(page: Page): Promise<Id<'sidebarItems'>> {
  await waitForCanvasRuntime(page)
  const canvasId = await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getCanvasId())
  if (!canvasId) {
    throw new Error('Missing canvas runtime canvas id')
  }
  return canvasId as Id<'sidebarItems'>
}

export async function getCanvasRuntimeSnapshot(page: Page): Promise<CanvasRuntimeSnapshot> {
  await waitForCanvasRuntime(page)
  const snapshot = await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getSnapshot())
  if (!snapshot) {
    throw new Error('Missing canvas runtime snapshot')
  }
  return snapshot as CanvasRuntimeSnapshot
}

export async function expectCanvasRuntimeSelection(
  page: Page,
  selection: { nodeIds?: Array<string>; edgeIds?: Array<string> },
) {
  await expect
    .poll(async () => {
      const snapshot = await getCanvasRuntimeSnapshot(page)
      return {
        nodeIds: snapshot.selection.nodeIds.sort(),
        edgeIds: snapshot.selection.edgeIds.sort(),
      }
    })
    .toEqual({
      nodeIds: [...(selection.nodeIds ?? [])].sort(),
      edgeIds: [...(selection.edgeIds ?? [])].sort(),
    })
}

export async function setCanvasSelectionViaRuntime(
  page: Page,
  selection: { nodeIds?: Array<string>; edgeIds?: Array<string> },
) {
  await waitForCanvasRuntime(page)
  await page.evaluate((nextSelection) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.setSelection(nextSelection)
  }, selection)
  await expectCanvasRuntimeSelection(page, selection)
}

export async function seedCanvasTextNodesViaRuntime(
  page: Page,
  options: {
    columns?: number
    count: number
    idPrefix?: string
    labelPrefix?: string
    position?: CanvasPoint
    size?: { width: number; height: number }
    spacingX?: number
    spacingY?: number
    start?: CanvasPoint
    style?: Record<string, unknown>
    zIndex?: number
  },
) {
  await waitForCanvasRuntime(page)
  await page.evaluate((seedOptions) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.seedTextNodes(seedOptions)
  }, options)
  await expect.poll(() => getCanvasNodesByType(page, 'text').count()).toBe(options.count)
}

export async function seedCanvasStrokeNodesViaRuntime(
  page: Page,
  options: {
    columns?: number
    count: number
    idPrefix?: string
    position?: CanvasPoint
    pointsPerStroke?: number
    spacingX?: number
    spacingY?: number
    start?: CanvasPoint
    style?: {
      color?: string
      opacity?: number
      size?: number
    }
    zIndex?: number
  },
) {
  await waitForCanvasRuntime(page)
  await page.evaluate((seedOptions) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.seedStrokeNodes(seedOptions)
  }, options)
  await expect.poll(() => getCanvasNodesByType(page, 'stroke').count()).toBe(options.count)
}

export async function seedCanvasEdgeViaRuntime(
  page: Page,
  options: {
    id?: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
    type?: CanvasDocumentEdge['type']
    style?: CanvasDocumentEdge['style']
    zIndex?: number
  },
) {
  await waitForCanvasRuntime(page)
  await page.evaluate((edgeOptions) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.seedEdge(edgeOptions)
  }, options)
  await expect.poll(() => getCanvasEdges(page).count()).toBeGreaterThan(0)
}

export async function seedCanvasEmbedNodeViaRuntime(
  page: Page,
  options: {
    id: string
    sidebarItemId: Id<'sidebarItems'>
    position: CanvasPoint
    width?: number
    height?: number
    zIndex?: number
  },
) {
  await waitForCanvasRuntime(page)
  await page.evaluate((embedOptions) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.seedEmbedNode(embedOptions)
  }, options)
  await expect(getCanvasNodeById(page, options.id)).toBeVisible({ timeout: 10_000 })
}

export async function seedCanvasCoordinateProbeNodeViaRuntime(
  page: Page,
  id: string,
  start: CanvasPoint,
) {
  await waitForCanvasRuntime(page)
  await page.evaluate(
    ({ nodeId, position }) => {
      window.__WA_CANVAS_PERF_RUNTIME__?.seedCoordinateProbeNode({ id: nodeId, start: position })
    },
    { nodeId: id, position: start },
  )
  await expect(getCanvasNodeById(page, id)).toBeVisible({ timeout: 10_000 })
}

export async function setCanvasViewportViaRuntime(page: Page, viewport: CanvasViewportState) {
  await waitForCanvasRuntime(page)
  await page.evaluate((nextViewport) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.setViewport(nextViewport)
  }, viewport)
  await expect
    .poll(() => page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getViewport()))
    .toEqual(viewport)
}

export async function getCanvasViewportViaRuntime(page: Page): Promise<CanvasViewportState> {
  await waitForCanvasRuntime(page)
  const viewport = await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getViewport())
  if (!viewport) {
    throw new Error('Missing canvas runtime viewport')
  }
  return viewport
}

export async function expectCanvasNodeModel(
  page: Page,
  nodeId: string,
  expected: {
    position?: Partial<CanvasPoint>
    width?: number
    height?: number
    type?: string
    data?: Record<string, unknown>
  },
) {
  await expect
    .poll(async () => {
      const snapshot = await getCanvasRuntimeSnapshot(page)
      const node = snapshot.nodes.find((candidate) => candidate.id === nodeId)
      if (!node) return null
      return {
        type: node.type,
        position: node.position,
        width: node.width,
        height: node.height,
        data: node.data,
      }
    })
    .toMatchObject(expected)
}

export async function getCanvasNodeModel(page: Page, nodeId: string) {
  const snapshot = await getCanvasRuntimeSnapshot(page)
  const node = snapshot.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) {
    throw new Error(`Missing canvas node ${nodeId}`)
  }

  return node
}

export async function expectCanvasEdgeModel(
  page: Page,
  edgeId: string,
  expected: {
    source?: string
    target?: string
    type?: string
    style?: Record<string, unknown>
  },
) {
  await expect
    .poll(async () => {
      const snapshot = await getCanvasRuntimeSnapshot(page)
      const edge = snapshot.edges.find((candidate) => candidate.id === edgeId)
      if (!edge) return null
      return edge
    })
    .toMatchObject(expected)
}

export async function getCanvasRuntimeNodePosition(
  page: Page,
  nodeId: string,
): Promise<CanvasPoint> {
  await waitForCanvasRuntime(page)
  const position = await page.evaluate(
    (id) => window.__WA_CANVAS_PERF_RUNTIME__?.getNodePosition(id),
    nodeId,
  )
  if (!position) {
    throw new Error(`Missing canvas runtime node position for ${nodeId}`)
  }
  return position
}

export async function selectFirstCanvasNodesViaRuntime(page: Page, count: number) {
  await waitForCanvasRuntime(page)
  await page.evaluate((selectedCount) => {
    window.__WA_CANVAS_PERF_RUNTIME__?.selectFirstNodes(selectedCount)
  }, count)
  await expect
    .poll(() => page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getSelectedCount()))
    .toBe(count)
}

export async function clearCanvasRuntimeMetrics(page: Page) {
  await waitForCanvasRuntime(page)
  await page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.clearMetrics())
}

export async function getCanvasRuntimeMetrics(page: Page) {
  await waitForCanvasRuntime(page)
  return page.evaluate(() => window.__WA_CANVAS_PERF_RUNTIME__?.getMetrics() ?? [])
}

export async function canvasToScreenPoint(page: Page, point: CanvasPoint) {
  const pane = getCanvasPane(page)
  await expect(pane).toBeVisible({ timeout: 10000 })
  const [box, viewport] = await Promise.all([pane.boundingBox(), getCanvasViewportViaRuntime(page)])
  if (!box) {
    throw new Error('Canvas pane is not visible')
  }

  return {
    x: box.x + viewport.x + point.x * viewport.zoom,
    y: box.y + viewport.y + point.y * viewport.zoom,
  }
}

export async function wheelCanvasPane(
  page: Page,
  delta: CanvasPoint,
  options: { controlOrMeta?: boolean } = {},
) {
  const paneBox = await getCanvasPane(page).boundingBox()
  if (!paneBox) throw new Error('Canvas pane is not visible')
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

  await page.mouse.move(paneBox.x + paneBox.width / 2, paneBox.y + paneBox.height / 2)
  if (options.controlOrMeta) {
    await page.keyboard.down(modifier)
  }
  try {
    await page.mouse.wheel(delta.x, delta.y)
  } finally {
    if (options.controlOrMeta) {
      await page.keyboard.up(modifier)
    }
  }
}

export async function expectSelectionWrapperEnclosesNodes(page: Page, nodeIds: Array<string>) {
  const nodeBoxes = await Promise.all(
    nodeIds.map(async (nodeId) => {
      const box = await getCanvasNodeById(page, nodeId).boundingBox()
      if (!box) throw new Error(`Canvas node ${nodeId} is not visible`)
      return box
    }),
  )
  const wrapperBox = await getCanvasSelectionResizeWrapper(page).boundingBox()
  if (!wrapperBox) {
    throw new Error('Selection wrapper is not visible')
  }

  const expectedLeft = Math.min(...nodeBoxes.map((box) => box.x))
  const expectedRight = Math.max(...nodeBoxes.map((box) => box.x + box.width))
  const expectedTop = Math.min(...nodeBoxes.map((box) => box.y))
  const expectedBottom = Math.max(...nodeBoxes.map((box) => box.y + box.height))

  expect(Math.abs(wrapperBox.x - expectedLeft)).toBeLessThanOrEqual(2)
  expect(Math.abs(wrapperBox.y - expectedTop)).toBeLessThanOrEqual(2)
  expect(Math.abs(wrapperBox.width - (expectedRight - expectedLeft))).toBeLessThanOrEqual(3)
  expect(Math.abs(wrapperBox.height - (expectedBottom - expectedTop))).toBeLessThanOrEqual(3)
}

export async function clickCanvasAt(page: Page, point: CanvasPoint) {
  const absolutePoint = await resolveCanvasPoint(page, point)
  await page.mouse.click(absolutePoint.x, absolutePoint.y)
}

export async function clickCanvasSpaceAt(page: Page, point: CanvasPoint) {
  const absolutePoint = await canvasToScreenPoint(page, point)
  await page.mouse.click(absolutePoint.x, absolutePoint.y)
}

export async function startCanvasPointerGesture(page: Page, point: CanvasPoint) {
  const absolutePoint = await resolveCanvasPoint(page, point)
  await page.mouse.move(absolutePoint.x, absolutePoint.y)
  await page.mouse.down()
}

export async function startCanvasSpacePointerGesture(page: Page, point: CanvasPoint) {
  const absolutePoint = await canvasToScreenPoint(page, point)
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

export async function moveCanvasSpacePointer(
  page: Page,
  point: CanvasPoint,
  { steps = 10 }: CanvasDragOptions = {},
) {
  const absolutePoint = await canvasToScreenPoint(page, point)
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

export async function dragOnCanvasSpace(
  page: Page,
  start: CanvasPoint,
  end: CanvasPoint,
  { steps = 12 }: CanvasDragOptions = {},
) {
  await startCanvasSpacePointerGesture(page, start)
  await moveCanvasSpacePointer(page, end, { steps })
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

export async function clickCanvasNode(
  page: Page,
  locator: Locator,
  options: {
    modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>
    positionRatio?: CanvasNodePositionRatio
  } = {},
) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Canvas node is not visible')
  }

  const positionRatio = options.positionRatio ?? { xRatio: 0.5, yRatio: 0.5 }
  const click = () =>
    page.mouse.click(
      box.x + box.width * positionRatio.xRatio,
      box.y + box.height * positionRatio.yRatio,
    )
  if (!options.modifiers?.length) {
    await click()
    return
  }

  for (const modifier of options.modifiers) {
    await page.keyboard.down(modifier)
  }
  await page.waitForTimeout(MODIFIER_SETTLE_DELAY_MS)
  try {
    await click()
  } finally {
    for (const modifier of [...options.modifiers].reverse()) {
      await page.keyboard.up(modifier)
    }
  }
}

export async function dragCanvasNode(
  page: Page,
  locator: Locator,
  delta: CanvasPoint,
  options: { positionRatio?: CanvasNodePositionRatio } = {},
) {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Canvas node is not visible')
  }

  const positionRatio = options.positionRatio ?? {
    xRatio: 0.5,
    yRatio: 0.5,
  }
  const start = {
    x: box.x + box.width * positionRatio.xRatio,
    y: box.y + box.height * positionRatio.yRatio,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 12 })
  await page.mouse.up()
}

export async function resizeCanvasNode(
  page: Page,
  locator: Locator,
  handlePosition: ResizeHandlePosition,
  delta: CanvasPoint,
  options: { modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'> } = {},
) {
  const handleTestId = `canvas-node-resize-handle-${handlePosition}`
  let handle = locator.getByTestId(handleTestId)
  if ((await handle.count()) === 0) {
    handle = locator.page().getByTestId(handleTestId)
  }
  if ((await handle.count()) === 0) {
    handle = locator.page().getByRole('button', { name: getResizeHandleLabel(handlePosition) })
  }
  const box = await handle.boundingBox()
  if (!box) {
    throw new Error(`Resize handle ${handlePosition} is not visible`)
  }

  const start = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }

  for (const modifier of options.modifiers ?? []) {
    await page.keyboard.down(modifier)
  }
  try {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 10 })
    await page.mouse.up()
  } finally {
    for (const modifier of [...(options.modifiers ?? [])].reverse()) {
      await page.keyboard.up(modifier)
    }
  }
}

function getResizeHandleLabel(handlePosition: ResizeHandlePosition) {
  switch (handlePosition) {
    case 'top-left':
      return 'Resize top-left selection corner'
    case 'top':
      return 'Resize top selection edge'
    case 'top-right':
      return 'Resize top-right selection corner'
    case 'right':
      return 'Resize right selection edge'
    case 'bottom-right':
      return 'Resize bottom-right selection corner'
    case 'bottom':
      return 'Resize bottom selection edge'
    case 'bottom-left':
      return 'Resize bottom-left selection corner'
    case 'left':
      return 'Resize left selection edge'
    default:
      return ''
  }
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
