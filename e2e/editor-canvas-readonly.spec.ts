import { expect, test } from '@playwright/test'

test.describe('readonly canvas', () => {
  test('projects a render-only canvas thumbnail in the folder dashboard', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Create resource', exact: true }).click()
    await page.getByRole('textbox', { name: 'New resource title' }).fill('Preview folder')
    await page.getByRole('menuitem', { name: 'Folder' }).click()
    const folder = page
      .getByLabel('resources resource drop zone')
      .getByRole('button', { name: 'Preview folder', exact: true })
    await folder.click()
    await page.getByRole('button', { name: 'Canvas', exact: true }).click()
    await folder.click()

    const preview = page.getByTestId('canvas-readonly-preview')
    await expect(preview).toBeVisible()
    await expect(preview.getByTestId('canvas-preview-node')).toHaveCount(0)
    await expect(preview.getByRole('textbox')).not.toBeVisible()
    await expect(preview.getByRole('toolbar')).not.toBeVisible()
  })

  test('renders canonical content while allowing navigation but no mutation path', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=revealed-in-play', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()

    const editor = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    const surface = editor.getByRole('region', { name: 'Canvas surface' })
    const nodes = editor.getByTestId('canvas-node')
    await expect(editor).toHaveAttribute('data-workspace-mode', 'viewer')
    await expect(nodes).toHaveCount(2)
    await expect(editor.getByTestId('canvas-edge')).toHaveCount(1)
    await expect(editor.getByRole('button', { name: 'Pointer' })).not.toBeVisible()
    await expect(editor.getByRole('button', { name: 'Text' })).not.toBeVisible()
    await expect(editor.getByRole('button', { name: 'Zoom in' })).toBeVisible()
    await expect(editor.getByRole('textbox', { name: 'Canvas text' })).toHaveAttribute(
      'contenteditable',
      'false',
    )

    const firstNode = nodes.first()
    const before = await firstNode.getAttribute('style')
    await firstNode.dragTo(surface, {
      sourcePosition: { x: 20, y: 20 },
      targetPosition: { x: 600, y: 400 },
    })
    await expect(firstNode).toHaveAttribute('style', before ?? '')

    await firstNode.dblclick({ position: { x: 20, y: 20 } })
    await expect(editor.getByRole('textbox', { name: 'Canvas text' })).toHaveAttribute(
      'contenteditable',
      'false',
    )
    await editor.focus()
    await page.keyboard.press('Delete')
    await expect(nodes).toHaveCount(2)

    await firstNode.click({ button: 'right', position: { x: 20, y: 20 } })
    const menu = page.getByRole('menu', { name: 'Canvas actions' })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).not.toBeVisible()
    await page.keyboard.press('Escape')

    await editor.getByRole('button', { name: 'Zoom in' }).click()
    await expect(editor).toContainText('120%')
  })
})
