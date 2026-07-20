import { expect, test } from '@playwright/test'
import { dragPointer, openDemoCanvas, visibleBox } from './helpers/editor-canvas-helpers'
import { sidebarResource } from './helpers/editor-resource-helpers'

test.describe('canvas gesture parity', () => {
  test('adds one embed for each repeated sidebar resource drop', async ({ page }) => {
    const { nodes, surface } = await openDemoCanvas(page)
    const note = sidebarResource(page, 'The Lantern Market')
    await sidebarResource(page, 'Harbor Heist Board').click()
    const initialCount = await nodes.count()

    await note.dragTo(surface, { targetPosition: { x: 360, y: 220 } })
    await expect(nodes).toHaveCount(initialCount + 1)

    await note.dragTo(surface, { targetPosition: { x: 620, y: 340 } })
    await expect(nodes).toHaveCount(initialCount + 2)
  })

  test('restores reference click and drag text placement geometry', async ({ page }) => {
    const { editor, nodes, surface } = await openDemoCanvas(page)
    await editor.focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Delete')
    await expect(nodes).toHaveCount(0)

    const surfaceBox = await visibleBox(surface)
    const clickPoint = { x: surfaceBox.x + 420, y: surfaceBox.y + 300 }
    await editor.getByRole('button', { name: 'Text' }).click()
    await page.mouse.click(clickPoint.x, clickPoint.y)
    await expect(nodes).toHaveCount(1)

    const defaultNode = await visibleBox(nodes.first())
    expect(Math.abs(defaultNode.x - (clickPoint.x - 160))).toBeLessThanOrEqual(2)
    expect(Math.abs(defaultNode.y - (clickPoint.y - 120))).toBeLessThanOrEqual(2)
    expect(Math.abs(defaultNode.width - 320)).toBeLessThanOrEqual(2)
    expect(Math.abs(defaultNode.height - 240)).toBeLessThanOrEqual(2)

    await page.keyboard.press('Escape')
    await editor.getByRole('button', { name: 'Text' }).click()
    const dragStart = { x: surfaceBox.x + 740, y: surfaceBox.y + 220 }
    const dragEnd = { x: dragStart.x + 200, y: dragStart.y + 140 }
    await page.mouse.move(dragStart.x, dragStart.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 })

    const preview = await visibleBox(editor.getByTestId('canvas-text-placement'))
    expect(Math.abs(preview.x - dragStart.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(preview.y - dragStart.y)).toBeLessThanOrEqual(2)
    expect(Math.abs(preview.width - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(preview.height - 140)).toBeLessThanOrEqual(2)

    await page.mouse.up()
    await expect(editor.getByTestId('canvas-text-placement')).toHaveCount(0)
    await expect(nodes).toHaveCount(2)
    const draggedNode = await visibleBox(nodes.last())
    expect(Math.abs(draggedNode.x - dragStart.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(draggedNode.y - dragStart.y)).toBeLessThanOrEqual(2)
    expect(Math.abs(draggedNode.width - 200)).toBeLessThanOrEqual(2)
    expect(Math.abs(draggedNode.height - 140)).toBeLessThanOrEqual(2)
  })

  test('resizes, draws, erases, and restores the resulting canonical changes', async ({ page }) => {
    const { editor, nodes, surface } = await openDemoCanvas(page)
    await expect(nodes).toHaveCount(2)

    const firstNode = nodes.first()
    await firstNode.dragTo(surface, {
      sourcePosition: { x: 20, y: 20 },
      targetPosition: { x: 400, y: 250 },
    })
    const beforeResize = await visibleBox(firstNode)
    const handle = editor.getByRole('button', {
      name: 'Resize bottom-right selection corner',
    })
    const handleBox = await visibleBox(handle)
    const surfaceBox = await visibleBox(surface)
    await dragPointer(
      page,
      { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 },
      { x: handleBox.x + handleBox.width / 2 + 90, y: handleBox.y + handleBox.height / 2 + 60 },
    )
    await expect
      .poll(async () => {
        const resized = await visibleBox(firstNode)
        return resized.width > beforeResize.width + 60 && resized.height > beforeResize.height + 40
      })
      .toBe(true)

    await editor.getByRole('button', { name: 'Draw' }).click()
    const drawY = surfaceBox.y + surfaceBox.height - 100
    await dragPointer(
      page,
      { x: surfaceBox.x + 280, y: drawY },
      { x: surfaceBox.x + 460, y: drawY + 30 },
      24,
    )
    const strokes = editor.locator('[data-testid="canvas-node"][data-node-type="stroke"]')
    await expect(strokes).toHaveCount(1)

    await editor.getByRole('button', { name: 'Eraser' }).click()
    const strokeBox = await visibleBox(strokes.first())
    await dragPointer(
      page,
      { x: strokeBox.x - 15, y: strokeBox.y + strokeBox.height / 2 },
      { x: strokeBox.x + strokeBox.width + 15, y: strokeBox.y + strokeBox.height / 2 },
      18,
    )
    await expect(strokes).toHaveCount(0)

    await editor.getByRole('button', { name: 'Undo' }).click()
    await expect(strokes).toHaveCount(1)
    await editor.getByRole('button', { name: 'Redo' }).click()
    await expect(strokes).toHaveCount(0)
  })

  test('authors edges and keeps marquee, lasso, modifier, and transformed edge selection exact', async ({
    page,
  }) => {
    const { edges, editor, nodes, surface } = await openDemoCanvas(page)
    await expect(edges).toHaveCount(1)
    await editor.getByRole('button', { name: 'Edges' }).click()
    const source = await visibleBox(nodes.last().getByTestId('canvas-node-handle-left'))
    const target = await visibleBox(nodes.first().getByTestId('canvas-node-handle-right'))
    await dragPointer(
      page,
      { x: source.x + source.width / 2, y: source.y + source.height / 2 },
      { x: target.x + target.width / 2, y: target.y + target.height / 2 },
    )
    await expect(edges).toHaveCount(2)

    await editor.getByRole('button', { name: 'Pointer' }).click()
    await editor.focus()
    await page.keyboard.press('Escape')
    const surfaceBox = await visibleBox(surface)
    const nodeBoxes = await Promise.all([visibleBox(nodes.first()), visibleBox(nodes.last())])
    const left = Math.max(surfaceBox.x + 4, Math.min(...nodeBoxes.map((box) => box.x)) - 16)
    const top = Math.max(surfaceBox.y + 4, Math.min(...nodeBoxes.map((box) => box.y)) - 16)
    const right = Math.max(...nodeBoxes.map((box) => box.x + box.width)) + 16
    const bottom = Math.max(...nodeBoxes.map((box) => box.y + box.height)) + 16
    await dragPointer(page, { x: left, y: top }, { x: right, y: bottom }, 20)
    await expect(nodes.first()).toHaveAttribute('data-selected', 'true')
    await expect(nodes.last()).toHaveAttribute('data-selected', 'true')

    await editor.focus()
    await page.keyboard.press('Escape')
    await editor.getByRole('button', { name: 'Lasso select' }).click()
    const firstBox = await visibleBox(nodes.first())
    const polygon = [
      { x: firstBox.x - 12, y: firstBox.y - 12 },
      { x: firstBox.x + firstBox.width + 12, y: firstBox.y - 12 },
      { x: firstBox.x + firstBox.width + 12, y: firstBox.y + firstBox.height + 12 },
      { x: firstBox.x - 12, y: firstBox.y + firstBox.height + 12 },
      { x: firstBox.x - 12, y: firstBox.y - 12 },
    ]
    await page.mouse.move(polygon[0]!.x, polygon[0]!.y)
    await page.mouse.down()
    for (const point of polygon.slice(1)) await page.mouse.move(point.x, point.y, { steps: 5 })
    await page.mouse.up()
    await expect(nodes.first()).toHaveAttribute('data-selected', 'true')
    await expect(nodes.last()).toHaveAttribute('data-selected', 'false')

    await editor.getByRole('button', { name: 'Pointer' }).click()
    await nodes.last().click({ modifiers: ['Control'], position: { x: 100, y: 140 } })
    await expect(nodes.first()).toHaveAttribute('data-selected', 'true')
    await expect(nodes.last()).toHaveAttribute('data-selected', 'true')

    await editor.getByRole('button', { name: 'Zoom in' }).click()
    await edges.first().dispatchEvent('pointerdown', { button: 0 })
    await expect(edges.first()).toHaveAttribute('data-selected', 'true')
  })
})
