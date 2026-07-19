import { expect, test } from '@playwright/test'
import {
  dragPointer,
  openDemoCanvas,
  visibleBox,
  visibleCanvasNodePoint,
} from './helpers/editor-canvas-helpers'

test.describe('canvas viewport parity', () => {
  test('routes zoom, wheel, hand, middle-button, fit, coordinate, and persistence behavior', async ({
    page,
  }) => {
    const { editor, nodes, surface, viewport } = await openDemoCanvas(page)
    const surfaceBox = await visibleBox(surface)
    const viewportStyle = () => viewport.getAttribute('style')
    const gridSize = () => surface.evaluate((element) => element.style.backgroundSize)

    const initial = await viewportStyle()
    const initialGridSize = await gridSize()
    await editor.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(viewportStyle).not.toBe(initial)
    await expect.poll(gridSize).not.toBe(initialGridSize)

    const nodeBox = await visibleBox(nodes.first())
    await dragPointer(page, visibleCanvasNodePoint(nodeBox, surfaceBox), {
      x: surfaceBox.x + 360,
      y: surfaceBox.y + 260,
    })
    await expect
      .poll(async () => {
        const moved = await visibleBox(nodes.first())
        return Math.abs(moved.x - nodeBox.x) > 30 && Math.abs(moved.y - nodeBox.y) > 30
      })
      .toBe(true)

    const beforeWheel = await viewportStyle()
    await page.mouse.move(surfaceBox.x + 20, surfaceBox.y + surfaceBox.height - 20)
    await page.mouse.wheel(120, 80)
    await expect.poll(viewportStyle).not.toBe(beforeWheel)

    await editor.getByRole('button', { name: 'Panning' }).click()
    const beforeHand = await viewportStyle()
    await dragPointer(
      page,
      { x: surfaceBox.x + surfaceBox.width * 0.65, y: surfaceBox.y + surfaceBox.height * 0.7 },
      {
        x: surfaceBox.x + surfaceBox.width * 0.65 + 70,
        y: surfaceBox.y + surfaceBox.height * 0.7 + 45,
      },
    )
    await expect.poll(viewportStyle).not.toBe(beforeHand)

    await editor.getByRole('button', { name: 'Pointer' }).click()
    const beforeMiddle = await viewportStyle()
    await dragPointer(
      page,
      { x: surfaceBox.x + surfaceBox.width * 0.7, y: surfaceBox.y + surfaceBox.height * 0.75 },
      { x: surfaceBox.x + surfaceBox.width * 0.7 + 50, y: surfaceBox.y + surfaceBox.height * 0.75 },
      10,
      'middle',
    )
    await expect.poll(viewportStyle).not.toBe(beforeMiddle)

    await editor.getByRole('button', { name: 'Fit zoom' }).click()
    const fitted = await viewportStyle()
    await expect.poll(viewportStyle).not.toBe(beforeMiddle)
    const zoomButton = await editor.getByRole('button', { name: 'Zoom in' }).elementHandle()
    if (!zoomButton) throw new Error('Zoom control is not visible')
    expect(await viewport.evaluate((element, button) => element.contains(button), zoomButton)).toBe(
      false,
    )

    await page.reload()
    const reopened = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    await expect(reopened.getByTestId('canvas-viewport')).toHaveAttribute('style', fitted ?? '')
  })
})
