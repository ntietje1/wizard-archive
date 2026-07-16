import { expect, test } from '@playwright/test'
import { dragPointer, visibleBox } from './helpers/editor-canvas-helpers'

test.describe('canvas performance smoke', () => {
  test.setTimeout(60_000)

  test('keeps a large canonical scene responsive and culls it after viewport motion', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=connected-canvas', { waitUntil: 'commit' })
    const editor = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    const surface = editor.getByRole('region', { name: 'Canvas surface' })
    const nodes = editor.getByTestId('canvas-node')
    await expect(nodes).toHaveCount(2)
    await editor.focus()

    const startedAt = Date.now()
    for (let index = 0; index < 9; index += 1) {
      await page.keyboard.press('Control+a')
      await page.keyboard.press('Control+d')
    }
    await expect(nodes).toHaveCount(512)
    await page.keyboard.press('Escape')

    await editor.getByRole('button', { name: 'Zoom in' }).click()
    const firstNode = nodes.first()
    await firstNode.dragTo(surface, {
      sourcePosition: { x: 20, y: 20 },
      targetPosition: { x: 600, y: 400 },
    })
    await expect(firstNode).toBeVisible()
    expect(Date.now() - startedAt).toBeLessThan(15_000)

    const bounds = await surface.boundingBox()
    if (!bounds) throw new Error('Canvas surface is not visible')
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
    const viewport = editor.getByTestId('canvas-viewport')
    expect(Number(await viewport.getAttribute('data-surface-width'))).toBeGreaterThan(0)
    const viewportBeforePan = await viewport.getAttribute('style')
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.wheel(2_000, 2_000)
    await expect.poll(() => viewport.getAttribute('style')).not.toBe(viewportBeforePan)
    await expect(nodes).toHaveCount(0)

    await editor.getByRole('button', { name: 'Fit view' }).click()
    await expect(nodes).toHaveCount(512)

    const fittedBounds = await visibleBox(surface)
    const geometryStartedAt = Date.now()
    await editor.getByRole('button', { name: 'Lasso select' }).click()
    const inset = 8
    const lasso = [
      { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
      { x: fittedBounds.x + inset, y: fittedBounds.y + inset },
      { x: fittedBounds.x + fittedBounds.width - inset, y: fittedBounds.y + inset },
      {
        x: fittedBounds.x + fittedBounds.width - inset,
        y: fittedBounds.y + fittedBounds.height - inset,
      },
      { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
    ]
    await page.mouse.move(lasso[0]!.x, lasso[0]!.y)
    await page.mouse.down()
    await page.mouse.move(lasso[1]!.x, lasso[1]!.y)
    await page.mouse.move(lasso[2]!.x, lasso[2]!.y)
    await page.mouse.move(lasso[3]!.x, lasso[3]!.y)
    await page.mouse.move(lasso[4]!.x, lasso[4]!.y)
    await page.mouse.up()
    await editor.getByRole('button', { name: 'Pointer' }).click()
    const selection = editor.getByTestId('canvas-selection-resize-wrapper')
    await expect(selection).toBeVisible()

    await page.keyboard.press('Escape')
    await dragPointer(
      page,
      { x: fittedBounds.x + inset, y: fittedBounds.y + fittedBounds.height - inset },
      { x: fittedBounds.x + fittedBounds.width - inset, y: fittedBounds.y + inset },
      4,
    )
    await expect(selection).toBeVisible()
    const resize = editor.getByRole('button', { name: 'Resize bottom right' })
    const resizeBounds = await visibleBox(resize)
    await page.keyboard.down('Control')
    await dragPointer(
      page,
      { x: resizeBounds.x + resizeBounds.width / 2, y: resizeBounds.y + resizeBounds.height / 2 },
      {
        x: resizeBounds.x + resizeBounds.width / 2 + 16,
        y: resizeBounds.y + resizeBounds.height / 2 + 16,
      },
      4,
    )
    await page.keyboard.up('Control')
    await expect(selection).toBeVisible()
    expect(Date.now() - geometryStartedAt).toBeLessThan(5_000)
  })
})
