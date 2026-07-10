import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function getEditor(page: Page) {
  const editor = page.locator('[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 30000 })
  return editor
}

export async function typeInEditor(page: Page, text: string) {
  const editor = await getEditor(page)
  await editor.focus()
  await page.keyboard.type(text)
}

export async function openSlashMenu(page: Page) {
  const editor = await getEditor(page)
  const paragraphs = editor.locator('p')
  if ((await paragraphs.count()) > 0) {
    await paragraphs.last().click()
  } else {
    await editor.click()
  }
  await page.keyboard.type('/')
  const menu = page.locator('[data-testid="slash-menu"] [role="listbox"]')
  await expect(menu).toBeVisible({ timeout: 5000 })
  return menu
}

export async function selectSlashMenuItem(page: Page, itemName: string | RegExp) {
  const menu = await openSlashMenu(page)
  await menu.getByRole('option', { name: itemName }).click()
  await expect(menu).not.toBeVisible({ timeout: 5000 })
}

export async function newParagraphAtEnd(page: Page) {
  const editor = await getEditor(page)
  const paragraphs = editor.locator('p')
  const initialParagraphCount = await paragraphs.count()
  await editor.click()
  const endShortcut = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End'
  await page.keyboard.press(endShortcut)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect
    .poll(
      async () => {
        const paragraphCount = await paragraphs.count()
        if (paragraphCount > initialParagraphCount) return true
        if (paragraphCount === 0) return false

        const lastParagraphText = await paragraphs
          .last()
          .textContent()
          .catch(() => null)
        return lastParagraphText?.trim() === ''
      },
      { timeout: 5000 },
    )
    .toBe(true)
  await paragraphs.last().click()
}
