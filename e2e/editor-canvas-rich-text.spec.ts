import { expect, test } from '@playwright/test'

test.describe('canvas rich text', () => {
  test('formats canonical text and preserves it across editor and resource lifecycles', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const canvas = page.getByRole('application', { name: 'Harbor Heist Board canvas editor' })
    const nodes = canvas.getByTestId('canvas-node')
    await expect(nodes).toHaveCount(2)

    await canvas.getByRole('button', { name: 'Text' }).click()
    const surface = canvas.getByRole('region', { name: 'Canvas surface' })
    const bounds = await surface.boundingBox()
    if (!bounds) throw new Error('Canvas surface is not visible')
    await page.mouse.click(bounds.x + bounds.width * 0.55, bounds.y + bounds.height * 0.55)
    await expect(nodes).toHaveCount(3)

    const editor = nodes.last().getByRole('textbox', { name: 'Canvas text' })
    await expect(editor).toBeVisible()
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    await editor.press('Escape')
    await expect(editor).toHaveAttribute('contenteditable', 'false')
    await nodes.last().dblclick()
    await expect(editor).toHaveAttribute('contenteditable', 'true')
    const editorElement = await editor.elementHandle()
    if (!editorElement) throw new Error('Canvas text editor is not mounted')
    await editor.fill('Rich toolbar text')
    await editor.press('Control+A')

    const toolbar = page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    await expect(toolbar).toBeVisible()
    await editor
      .locator('p, h1, h2, h3')
      .first()
      .click({ modifiers: ['Control'] })
    await expect(editor.locator('.ProseMirror-selectednode')).toHaveCount(0)
    await editor.press('Control+A')
    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await toolbar.getByRole('button', { name: 'Italic' }).click()
    await toolbar.getByRole('button', { name: 'Align center' }).click()
    await toolbar.getByRole('button', { name: 'Block type' }).click()
    await page.getByRole('menuitemradio', { name: 'Heading 2', exact: true }).click()
    await toolbar.getByRole('button', { name: 'Text color' }).click()
    await page.getByRole('button', { name: 'Select Red text color' }).click()

    await editor.press('Escape')
    expect(
      await editorElement.evaluate((element) => ({
        connected: element.isConnected,
        editable: element.getAttribute('contenteditable'),
      })),
    ).toEqual({ connected: true, editable: 'false' })
    const formattedText = nodes.last().getByText('Rich toolbar text', { exact: true })
    await expect(
      nodes.last().getByRole('heading', { level: 2, name: 'Rich toolbar text' }),
    ).toBeVisible()
    await expect(formattedText).toHaveAttribute('data-value', 'var(--t-red)')
    await expect(formattedText).toHaveCSS('font-style', 'italic')
    expect(await formattedText.evaluate((element) => element.closest('strong') !== null)).toBe(true)

    await page.getByRole('button', { name: 'Moonwell Docks' }).click()
    await page.getByRole('button', { name: 'Harbor Heist Board' }).click()
    const reopenedCanvas = page.getByRole('application', {
      name: 'Harbor Heist Board canvas editor',
    })
    const reopenedNode = reopenedCanvas.getByTestId('canvas-node').last()
    await expect(
      reopenedNode.getByRole('heading', { level: 2, name: 'Rich toolbar text' }),
    ).toBeVisible()

    await reopenedNode.dblclick()
    const reopenedEditor = reopenedNode.getByRole('textbox', { name: 'Canvas text' })
    await reopenedEditor.getByRole('heading', { level: 2, name: 'Rich toolbar text' }).click()
    await reopenedEditor.press('Control+A')
    await expect(page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
  })
})
