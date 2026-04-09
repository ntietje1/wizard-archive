import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function getEditor(page: Page) {
  const editor = page.locator('[contenteditable="true"]').first()
  await expect(editor).toBeVisible({ timeout: 10000 })
  return editor
}

export async function typeInEditor(page: Page, text: string) {
  const editor = await getEditor(page)
  await editor.click()
  await page.keyboard.type(text)
}

export async function selectAllText(page: Page, selector?: string) {
  if (selector) {
    await page.click(selector)
  }
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await page.keyboard.press(`${mod}+a`)
  await page.waitForTimeout(100)
}

export async function applyFormatting(page: Page, shortcut: string) {
  const editor = await getEditor(page)
  await editor.focus()
  await page.keyboard.press(shortcut)
  await page.waitForTimeout(300)
}

export async function openSlashMenu(page: Page) {
  const editor = await getEditor(page)
  await editor.focus()
  await page.keyboard.type('/')
  const menu = page.getByRole('listbox')
  await expect(menu).toBeVisible({ timeout: 5000 })
  return menu
}

export async function selectSlashMenuItem(page: Page, itemName: string | RegExp) {
  await openSlashMenu(page)
  await page.getByRole('option', { name: itemName }).click()
  await page.waitForTimeout(300)
}

export async function newParagraphAtEnd(page: Page) {
  const editor = await getEditor(page)
  await editor.click()
  const endShortcut = process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End'
  await page.keyboard.press(endShortcut)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
}
