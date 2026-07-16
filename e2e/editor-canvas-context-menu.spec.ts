import { expect, test } from '@playwright/test'

test.describe('canvas context menus', () => {
  test.setTimeout(60_000)

  test('targets pane, node, edge, arrange, reorder, and clipboard actions', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const editor = page.getByRole('application', {
      name: 'Harbor Heist Board canvas editor',
    })
    await expect(editor).toBeVisible()
    const nodes = editor.getByTestId('canvas-node')
    const edges = editor.getByTestId('canvas-edge')
    const surface = editor.getByRole('region', { name: 'Canvas surface' })
    await expect(nodes).toHaveCount(2)
    await expect(edges).toHaveCount(1)

    await nodes.last().click({ button: 'right', position: { x: 100, y: 140 } })
    const menu = page.getByRole('menu', { name: 'Canvas actions' })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(nodes).toHaveCount(3)
    await editor.focus()
    await page.keyboard.press('Delete')
    await expect(nodes).toHaveCount(2)

    const bounds = await surface.boundingBox()
    if (!bounds) throw new Error('Canvas surface is not visible')
    const panePoint = {
      x: bounds.x + bounds.width * 0.68,
      y: bounds.y + bounds.height * 0.78,
    }
    await page.mouse.click(panePoint.x, panePoint.y, { button: 'right' })
    await menu.getByRole('menuitem', { name: 'Select All' }).click()

    await nodes.last().click({ button: 'right', position: { x: 100, y: 140 } })
    await menu.getByRole('menuitem', { name: 'Arrange' }).hover()
    await expect(page.getByRole('menuitem', { name: 'Align left' })).toBeVisible()
    await menu.getByRole('menuitem', { name: 'Reorder' }).hover()
    await expect(page.getByRole('menuitem', { name: 'Send to back' })).toBeVisible()
    await menu.getByRole('menuitem', { name: 'Copy' }).click()

    await page.mouse.click(panePoint.x, panePoint.y, { button: 'right' })
    await menu.getByRole('menuitem', { name: 'Paste' }).click()
    await expect(nodes).toHaveCount(4)
    await expect(edges).toHaveCount(2)

    await edges.first().dispatchEvent('contextmenu', { clientX: 600, clientY: 300 })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Copy' })).not.toBeVisible()
    await menu.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(edges).toHaveCount(1)

    await page.mouse.click(panePoint.x, panePoint.y, { button: 'right' })
    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })
})
