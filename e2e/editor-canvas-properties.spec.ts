import { expect, test } from '@playwright/test'
import { dragPointer, openDemoCanvas, visibleBox } from './helpers/editor-canvas-helpers'
import type { Locator } from '@playwright/test'

test.describe('canvas properties and arrangement', () => {
  test('uses the reference conditional toolbar for new drawing defaults', async ({ page }) => {
    const { editor, nodes, surface } = await openDemoCanvas(page)
    const initialNodeCount = await nodes.count()
    await editor.getByRole('button', { name: 'Draw' }).click()

    const toolbar = editor.getByRole('toolbar', { name: 'Canvas conditional toolbar' })
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('button', { name: 'Select Red color' }).click()
    await toolbar.getByRole('slider', { name: 'Stroke size' }).fill('8')

    const bounds = await visibleBox(surface)
    await dragPointer(
      page,
      { x: bounds.x + bounds.width * 0.65, y: bounds.y + bounds.height * 0.7 },
      { x: bounds.x + bounds.width * 0.8, y: bounds.y + bounds.height * 0.8 },
    )

    await expect(nodes).toHaveCount(initialNodeCount + 1)
    const stroke = editor.locator('[data-testid="canvas-node"][data-node-type="stroke"]').last()
    const visiblePath = stroke.locator('path')
    await expect(visiblePath).toHaveAttribute('fill', 'var(--t-red)')
    await expect(visiblePath).toHaveAttribute('opacity', '1')
  })

  test('projects mixed node state, fans out properties, arranges, and persists them', async ({
    page,
  }) => {
    const { editor, nodes } = await openDemoCanvas(page)
    const initialStyle = await nodeSurfaceStyle(nodes.first())
    await nodes.first().click({ position: { x: 20, y: 20 } })
    const properties = editor.getByRole('toolbar', { name: 'Canvas conditional toolbar' })
    await properties
      .getByRole('group', { name: 'Fill' })
      .getByRole('button', { name: 'Select Blue color' })
      .click()
    await properties
      .getByRole('group', { name: 'Stroke' })
      .getByRole('button', { name: 'Select Red color' })
      .click()
    const borderWidth = properties.getByRole('textbox', { name: 'Stroke size input' })
    await borderWidth.fill('6')
    await borderWidth.press('Enter')

    await expect.poll(() => nodeSurfaceStyle(nodes.first())).toMatchObject({ borderWidth: '6px' })
    await expect
      .poll(async () => (await nodeSurfaceStyle(nodes.first())).borderColor)
      .not.toBe(initialStyle.borderColor)

    await nodes.last().click({ modifiers: ['Control'], position: { x: 100, y: 140 } })
    await expect(properties.getByRole('group', { name: 'Fill' })).toHaveCount(0)
    await expect(borderWidth).toHaveAttribute('placeholder', '--')
    await borderWidth.fill('5')
    await borderWidth.press('Enter')
    await expect
      .poll(async () => {
        const [first, last] = await Promise.all([
          nodeSurfaceStyle(nodes.first()),
          nodeSurfaceStyle(nodes.last()),
        ])
        return {
          changed: first.borderWidth !== initialStyle.borderWidth,
          shared: first.borderWidth === last.borderWidth,
        }
      })
      .toEqual({ changed: true, shared: true })
    const persistedStyle = await nodeSurfaceStyle(nodes.first())

    await nodes.last().click({ button: 'right', position: { x: 100, y: 140 } })
    const menu = page.getByRole('menu', { name: 'Canvas actions' })
    await menu.getByRole('menuitem', { name: 'Arrange' }).hover()
    await page.getByRole('menuitem', { name: 'Align left' }).click()
    await expect
      .poll(async () => {
        const transforms = await Promise.all(
          [nodes.first(), nodes.last()].map((node) => node.getAttribute('style')),
        )
        return transforms.map((style) => /translate\(([-\d.]+)px/.exec(style ?? '')?.[1])
      })
      .toEqual(['40', '40'])

    await page.getByRole('button', { name: 'Moonwell Docks' }).click()
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const reopened = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    const reopenedNodes = reopened.getByTestId('canvas-node')
    await expect.poll(() => nodeSurfaceStyle(reopenedNodes.first())).toEqual(persistedStyle)
  })

  test('restyles and retypes an edge through the canonical property path', async ({ page }) => {
    const { edges, editor } = await openDemoCanvas(page)
    const primaryPath = edges.first().getByTestId('canvas-edge-primary-path')
    const beforePath = await primaryPath.getAttribute('d')
    await edges.first().dispatchEvent('pointerdown', { button: 0 })
    const properties = editor.getByRole('toolbar', { name: 'Canvas conditional toolbar' })
    await properties.getByRole('button', { name: 'Change edge type to Step' }).click()
    const stroke = properties.getByRole('group', { name: 'Stroke' })
    await stroke.getByRole('button', { name: 'Select Blue color' }).click()
    const width = properties.getByRole('textbox', { name: 'Stroke size input' })
    await width.fill('7')
    await width.press('Enter')
    await stroke.getByRole('button', { name: 'Open color picker' }).click()
    const opacityTrack = page.getByTestId('opacity-track')
    const opacityBounds = await visibleBox(opacityTrack)
    await page.mouse.click(
      opacityBounds.x + opacityBounds.width * 0.4,
      opacityBounds.y + opacityBounds.height / 2,
    )

    await expect(primaryPath).not.toHaveAttribute('d', beforePath ?? '')
    await expect(primaryPath).toHaveAttribute('stroke-width', '7')
    await expect(primaryPath).toHaveAttribute('stroke-opacity', '0.4')
    await editor.focus()
    await page.keyboard.press('Escape')
    await expect(primaryPath).toHaveAttribute('stroke', 'var(--t-blue)')

    await page.getByRole('button', { name: 'Moonwell Docks' }).click()
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const reopenedEdge = page
      .getByRole('application', { name: 'Harbor Heist Board canvas editor' })
      .getByTestId('canvas-edge')
      .first()
      .getByTestId('canvas-edge-primary-path')
    await expect(reopenedEdge).toHaveAttribute('stroke-width', '7')
    await expect(reopenedEdge).toHaveAttribute('stroke-opacity', '0.4')
  })

  test('keeps a routed edge rendered after both endpoint nodes are offscreen', async ({ page }) => {
    const { edges, editor, nodes, surface, viewport } = await openDemoCanvas(page)
    await expect(edges).toHaveCount(1)
    const routedEdgeId = await edges.first().getAttribute('data-edge-id')
    const path = parseCubicPath(
      await edges.first().getByTestId('canvas-edge-primary-path').getAttribute('d'),
    )

    for (let index = 0; index < 12; index += 1) {
      await editor.getByRole('button', { name: 'Zoom in' }).click()
    }
    await expect(viewport).toHaveAttribute('style', /scale\(4\)/)
    const surfaceBox = await visibleBox(surface)
    const midpoint = cubicMidpoint(path)
    await editor.getByRole('button', { name: 'Panning' }).click()
    await panViewportTo(page, surfaceBox, viewport, {
      x: surfaceBox.width / 2 - midpoint.x * 4,
      y: surfaceBox.height / 2 - midpoint.y * 4,
    })

    await expect
      .poll(async () => {
        const nodeBoxes = await Promise.all([visibleBox(nodes.first()), visibleBox(nodes.last())])
        return nodeBoxes.every((nodeBox) => !rectanglesIntersect(surfaceBox, nodeBox))
      })
      .toBe(true)
    const routedEdge = editor.locator(`[data-testid="canvas-edge"][data-edge-id="${routedEdgeId}"]`)
    await expect(routedEdge).toHaveCount(1)
    const edgeBox = await visibleBox(routedEdge.getByTestId('canvas-edge-primary-path'))
    expect(rectanglesIntersect(surfaceBox, edgeBox)).toBe(true)
  })
})

type CubicPath = Readonly<{
  source: Readonly<{ x: number; y: number }>
  sourceControl: Readonly<{ x: number; y: number }>
  targetControl: Readonly<{ x: number; y: number }>
  target: Readonly<{ x: number; y: number }>
}>

function parseCubicPath(value: string | null): CubicPath {
  const coordinates = value?.match(/-?\d+(?:\.\d+)?/g)?.map(Number)
  if (!coordinates || coordinates.length !== 8) throw new Error('Expected a cubic edge path')
  return {
    source: { x: coordinates[0]!, y: coordinates[1]! },
    sourceControl: { x: coordinates[2]!, y: coordinates[3]! },
    targetControl: { x: coordinates[4]!, y: coordinates[5]! },
    target: { x: coordinates[6]!, y: coordinates[7]! },
  }
}

function cubicMidpoint(path: CubicPath) {
  return {
    x:
      path.source.x / 8 +
      (path.sourceControl.x * 3) / 8 +
      (path.targetControl.x * 3) / 8 +
      path.target.x / 8,
    y:
      path.source.y / 8 +
      (path.sourceControl.y * 3) / 8 +
      (path.targetControl.y * 3) / 8 +
      path.target.y / 8,
  }
}

async function panViewportTo(
  page: Parameters<typeof dragPointer>[0],
  surface: Awaited<ReturnType<typeof visibleBox>>,
  viewport: Locator,
  target: Readonly<{ x: number; y: number }>,
) {
  for (let index = 0; index < 12; index += 1) {
    const current = parseViewportTransform(await viewport.getAttribute('style'))
    const delta = { x: target.x - current.x, y: target.y - current.y }
    if (Math.abs(delta.x) < 1 && Math.abs(delta.y) < 1) return
    const limit = Math.min(surface.width, surface.height) / 3
    const step = {
      x: Math.max(-limit, Math.min(limit, delta.x)),
      y: Math.max(-limit, Math.min(limit, delta.y)),
    }
    const start = { x: surface.x + surface.width / 2, y: surface.y + surface.height / 2 }
    await dragPointer(page, start, { x: start.x + step.x, y: start.y + step.y })
  }
  throw new Error('Canvas viewport did not reach the requested position')
}

function parseViewportTransform(value: string | null) {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(value ?? '')
  if (!match) throw new Error('Expected a canvas viewport transform')
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) }
}

function rectanglesIntersect(
  left: Awaited<ReturnType<typeof visibleBox>>,
  right: Awaited<ReturnType<typeof visibleBox>>,
) {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  )
}

async function nodeSurfaceStyle(node: Locator) {
  return node
    .locator(':scope > *')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
      }
    })
}
