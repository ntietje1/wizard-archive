import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function renameCurrentItem(page: Page, name: string) {
  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(textbox).toHaveValue(/.+/, { timeout: 10000 })
  await textbox.click()
  await textbox.fill(name)
  await textbox.press('Enter')
  await page.waitForTimeout(500)
}

export async function createNote(page: Page, name: string) {
  await page.getByRole('button', { name: 'Create new note' }).click()
  await renameCurrentItem(page, name)
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible({
    timeout: 10000,
  })
}

export async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: 'Create new folder' }).click()
  await renameCurrentItem(page, name)
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible({
    timeout: 10000,
  })
}

export async function openItem(page: Page, name: string) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await sidebar.getByRole('link', { name, exact: true }).click()
}

export async function openContextMenu(page: Page, itemName: string) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await sidebar
    .getByRole('link', { name: itemName, exact: true })
    .click({ button: 'right' })
}
