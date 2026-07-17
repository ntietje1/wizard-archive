import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('canonical note values', () => {
  test('authors dependencies, preserves drag identity, and renders in viewer mode', async ({
    page,
  }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'The Lantern Market' }).click()
    const editor = page.getByRole('textbox', { name: 'The Lantern Market note editor' })
    await expect(editor).toBeVisible()

    await insertValue(page)
    const source = page.getByRole('button', { name: 'Value: 0' })
    const sourceId = await source.getAttribute('data-note-value-id')
    expect(sourceId).toMatch(/^[0-9a-f-]{36}$/)
    await source.click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Value label' }).fill('Armor')
    await dialog.getByRole('combobox', { name: 'Value formula' }).fill('7')
    await dialog.getByRole('button', { name: 'Close value editor' }).click()

    await insertValue(page)
    const dependent = page.getByRole('button', { name: 'Value: 0' })
    await dependent.click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Value label' }).fill('Defense')
    await dialog.getByRole('combobox', { name: 'Value formula' }).fill(`{{${sourceId}}} * 2`)
    await dialog.getByRole('button', { name: 'Close value editor' }).click()
    await expect(page.getByRole('button', { name: 'Defense: 14' })).toBeVisible()

    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' Drop target')
    const armor = page.getByRole('button', { name: 'Armor: 7' })
    const target = editor.getByText('Drop target', { exact: false })
    const armorBox = await armor.boundingBox()
    const targetBox = await target.boundingBox()
    expect(armorBox).not.toBeNull()
    expect(targetBox).not.toBeNull()
    await page.mouse.move(armorBox!.x + armorBox!.width / 2, armorBox!.y + armorBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      targetBox!.x + targetBox!.width - 4,
      targetBox!.y + targetBox!.height / 2,
      {
        steps: 16,
      },
    )
    await page.mouse.up()
    await expect(page.locator(`[data-note-value-id="${sourceId}"]`)).toHaveCount(1)

    await page.getByRole('button', { name: 'Viewer' }).click()
    await expect(page.getByText('Viewer mode — editing is disabled')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Armor: 7' })).toBeVisible()
    await page.getByRole('button', { name: 'Armor: 7' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

async function insertValue(page: Page) {
  const editor = page.getByRole('textbox', { name: 'The Lantern Market note editor' })
  const lastBlock = editor.locator(':scope > .bn-block-group > .bn-block-outer').last()
  await lastBlock.hover()
  await page.getByRole('button', { name: 'Add block' }).click()
  await page.keyboard.type('/value')
  await page.getByRole('option', { name: /^Value/ }).click()
}
