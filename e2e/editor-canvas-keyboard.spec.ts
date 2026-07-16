import { expect, test } from '@playwright/test'

test.describe('canvas keyboard and clipboard', () => {
  test('selects, copies, cuts, pastes, and switches tools through the real editor', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const editor = page.getByRole('application', {
      name: 'Harbor Heist Board canvas editor',
    })
    await expect(editor).toBeVisible()
    const nodes = editor.getByTestId('canvas-node')
    const edges = editor.getByTestId('canvas-edge')
    await expect(nodes).toHaveCount(2)
    await expect(edges).toHaveCount(1)

    await editor.focus()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Control+C')
    await page.keyboard.press('Control+V')
    await expect(nodes).toHaveCount(4)
    await expect(edges).toHaveCount(2)

    await page.keyboard.press('Control+X')
    await expect(nodes).toHaveCount(2)
    await expect(edges).toHaveCount(1)
    await page.keyboard.press('Control+V')
    await expect(nodes).toHaveCount(4)
    await expect(edges).toHaveCount(2)

    await page.keyboard.press('Control+Z')
    await expect(nodes).toHaveCount(2)
    await expect(edges).toHaveCount(1)
    await page.keyboard.press('Control+Y')
    await expect(nodes).toHaveCount(4)
    await expect(edges).toHaveCount(2)

    await page.keyboard.press('Control+A')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Delete')
    await expect(nodes).toHaveCount(4)
    await expect(edges).toHaveCount(2)

    await page.keyboard.press('4')
    await expect(editor.getByRole('button', { name: 'Draw' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.keyboard.press('7')
    await expect(editor.getByRole('button', { name: 'Edges' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.keyboard.press('1')
    await expect(editor.getByRole('button', { name: 'Pointer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await editor.getByRole('button', { name: 'Text' }).click()
    const surface = editor.getByRole('region', { name: 'Canvas surface' })
    const bounds = await surface.boundingBox()
    if (!bounds) throw new Error('Canvas surface is not visible')
    await page.mouse.click(bounds.x + bounds.width - 120, bounds.y + bounds.height - 160)
    await expect(nodes).toHaveCount(5)
    await nodes.last().dblclick()
    const textEditor = editor.getByRole('textbox', { name: 'Canvas text' })
    await expect(textEditor).toBeVisible()
    await textEditor.fill('Keyboard edit target')
    await textEditor.press('Delete')
    await expect(nodes).toHaveCount(5)
    await expect(textEditor).toContainText('Keyboard edit target')
  })
})
