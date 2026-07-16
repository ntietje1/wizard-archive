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

    await nodes.last().dblclick()
    const editor = canvas.getByRole('textbox', { name: 'Canvas text' })
    await expect(editor).toBeVisible()
    await editor.fill('Rich toolbar text')
    await editor.press('Control+A')

    const toolbar = page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })
    await expect(toolbar).toBeVisible()
    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await toolbar.getByRole('button', { name: 'Italic' }).click()
    await toolbar.getByRole('button', { name: 'Align text center' }).click()
    await toolbar.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Heading 2', exact: true }).press('Enter')
    await toolbar.getByRole('button', { name: 'Colors' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Red' }).first().click()

    await editor.press('Escape')
    const formattedText = nodes.last().getByText('Rich toolbar text', { exact: true })
    await expect(
      nodes.last().getByRole('heading', { level: 2, name: 'Rich toolbar text' }),
    ).toBeVisible()
    await expect(formattedText).toHaveCSS('color', 'rgb(224, 62, 62)')
    await expect(formattedText).toHaveCSS('font-style', 'italic')
    await expect(formattedText).toHaveCSS('font-weight', '700')

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
    const reopenedEditor = reopenedCanvas.getByRole('textbox', { name: 'Canvas text' })
    await reopenedEditor.getByRole('heading', { level: 2, name: 'Rich toolbar text' }).click()
    await reopenedEditor.press('Control+A')
    await expect(page.getByRole('toolbar', { name: 'Canvas formatting toolbar' })).toBeVisible()
  })
})
