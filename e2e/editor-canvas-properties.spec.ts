import { expect, test } from '@playwright/test'
import { openDemoCanvas } from './helpers/editor-canvas-helpers'
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
})

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
