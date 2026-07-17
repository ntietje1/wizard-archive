import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

test.describe('canonical note values', () => {
  test('authors dependencies, preserves drag identity, and renders in viewer mode', async ({
    page,
  }) => {
    const editor = await openFreshNote(page)

    await insertValue(page, editor)
    const source = page.getByRole('button', { name: 'Value: 0' })
    const sourceId = await source.getAttribute('data-note-value-id')
    expect(sourceId).toMatch(/^[0-9a-f-]{36}$/)
    await source.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit Value' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Value label' }).fill('Armor')
    await dialog.getByRole('combobox', { name: 'Value formula' }).fill('7')
    await dialog.getByRole('button', { name: 'Close value editor' }).click()

    await insertValue(page, editor)
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
    await expect(page.getByRole('toolbar', { name: 'Note formatting toolbar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Armor: 7' })).toBeVisible()
    await page.getByRole('button', { name: 'Armor: 7' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

async function openFreshNote(page: Page) {
  await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
  const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
  await expect(workspace).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByRole('textbox', { name: 'New resource title' }).fill('Value scratchpad')
  await page.getByRole('menuitem', { name: 'Note' }).click()
  await expect(page.getByRole('heading', { name: 'Value scratchpad' })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'Value scratchpad note editor' })
  await expect(editor).toBeVisible()
  return editor
}

async function insertValue(page: Page, editor: Locator) {
  const inlineContent = editor.locator('.bn-inline-content').last()
  await inlineContent.click()
  await page.keyboard.press('End')
  if ((await editor.locator('[data-note-value-id]').count()) > 0) {
    await page.keyboard.type(' ')
  }
  await page.keyboard.type('/value')
  await page.getByRole('option', { name: /^Value/ }).click()
}
