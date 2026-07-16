import { expect, test } from '@playwright/test'
import { dragPointer, openDemoCanvas, visibleBox } from './helpers/editor-canvas-helpers'
import type { Locator } from '@playwright/test'

test.describe('canvas properties and arrangement', () => {
  test('projects mixed node state, fans out properties, arranges, and persists them', async ({
    page,
  }) => {
    const { editor, nodes } = await openDemoCanvas(page)
    const initialStyle = await nodeSurfaceStyle(nodes.first())
    await nodes.first().click({ position: { x: 20, y: 20 } })
    const properties = editor.getByRole('toolbar', { name: 'Canvas selection properties' })
    await properties.getByRole('combobox', { name: 'Fill color' }).selectOption({
      label: 'Fill: Blue',
    })
    await properties.getByRole('combobox', { name: 'Border color' }).selectOption({
      label: 'Border: Red',
    })
    const borderWidth = properties.getByRole('spinbutton', { name: 'Border width' })
    await borderWidth.fill('6')
    await borderWidth.press('Enter')

    await expect.poll(() => nodeSurfaceStyle(nodes.first())).toMatchObject({ borderWidth: '6px' })
    await expect
      .poll(async () => (await nodeSurfaceStyle(nodes.first())).borderColor)
      .not.toBe(initialStyle.borderColor)

    await nodes.last().click({ modifiers: ['Control'], position: { x: 100, y: 140 } })
    await expect(properties.getByRole('combobox', { name: 'Fill color' })).toHaveValue('')
    await properties.getByRole('combobox', { name: 'Fill color' }).selectOption({
      label: 'Fill: Red',
    })
    await expect
      .poll(async () => {
        const [first, last] = await Promise.all([
          nodeSurfaceStyle(nodes.first()),
          nodeSurfaceStyle(nodes.last()),
        ])
        return {
          changed: first.backgroundColor !== initialStyle.backgroundColor,
          shared: first.backgroundColor === last.backgroundColor,
        }
      })
      .toEqual({ changed: true, shared: true })
    const persistedStyle = await nodeSurfaceStyle(nodes.first())

    await editor
      .getByRole('combobox', { name: 'Arrange selection' })
      .selectOption({ label: 'Align left' })
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
    const beforePath = await edges.first().locator('path').last().getAttribute('d')
    await edges.first().dispatchEvent('pointerdown', { button: 0 })
    const properties = editor.getByRole('toolbar', { name: 'Canvas selection properties' })
    await properties.getByRole('combobox', { name: 'Edge type' }).selectOption('step')
    await properties.getByRole('combobox', { name: 'Line color' }).selectOption({
      label: 'Line: Blue',
    })
    const width = properties.getByRole('spinbutton', { name: 'Line width' })
    await width.fill('7')
    await width.press('Enter')
    const opacity = properties.getByRole('spinbutton', { name: 'Line opacity' })
    await opacity.fill('40')
    await opacity.press('Enter')

    const visiblePath = edges.first().locator('path').last()
    await expect(visiblePath).not.toHaveAttribute('d', beforePath ?? '')
    await expect(visiblePath).toHaveAttribute('stroke-width', '7')
    await expect(visiblePath).toHaveAttribute('stroke-opacity', '0.4')
    await editor.focus()
    await page.keyboard.press('Escape')
    await expect(visiblePath).toHaveAttribute('stroke', 'var(--t-blue)')

    await page.getByRole('button', { name: 'Moonwell Docks' }).click()
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const reopenedEdge = page
      .getByRole('application', { name: 'Harbor Heist Board canvas editor' })
      .getByTestId('canvas-edge')
      .first()
      .locator('path')
      .last()
    await expect(reopenedEdge).toHaveAttribute('stroke-width', '7')
    await expect(reopenedEdge).toHaveAttribute('stroke-opacity', '0.4')
  })

  test('keeps a routed crossing edge rendered after both endpoint nodes are culled', async ({
    page,
  }) => {
    const { edges, editor, nodes, surface, viewport } = await openDemoCanvas(page)
    await editor.getByRole('button', { name: 'Edges' }).click()
    const source = await visibleBox(nodes.first().getByTestId('canvas-node-handle-bottom'))
    const target = await visibleBox(nodes.last().getByTestId('canvas-node-handle-bottom'))
    await dragPointer(
      page,
      { x: source.x + source.width / 2, y: source.y + source.height / 2 },
      { x: target.x + target.width / 2, y: target.y + target.height / 2 },
    )
    await expect(edges).toHaveCount(2)
    const routedEdgeId = await edges.last().getAttribute('data-edge-id')
    const path = parseCubicPath(await edges.last().locator('path').last().getAttribute('d'))

    for (let index = 0; index < 12; index += 1) {
      await editor.getByRole('button', { name: 'Zoom in' }).click()
    }
    await expect(viewport).toHaveAttribute('style', /scale\(4\)/)
    const surfaceBox = await visibleBox(surface)
    const midpoint = cubicMidpoint(path)
    await editor.getByRole('button', { name: 'Hand' }).click()
    await panViewportTo(page, surfaceBox, viewport, {
      x: surfaceBox.width / 2 - midpoint.x * 4,
      y: surfaceBox.height / 2 - midpoint.y * 4,
    })

    await expect(viewport).toHaveAttribute('data-rendered-node-count', '0')
    const routedEdge = editor.locator(`[data-testid="canvas-edge"][data-edge-id="${routedEdgeId}"]`)
    await expect(routedEdge).toHaveCount(1)
    const edgeBox = await visibleBox(routedEdge.locator('path').last())
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
