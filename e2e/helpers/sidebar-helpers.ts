import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createNote(page: Page, name: string) {
  await page.getByRole('button', { name: /new note/i }).click()
  await page.getByRole('textbox').last().fill(name)
  await page.getByRole('textbox').last().press('Enter')
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

export async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: /new folder/i }).click()
  await page.getByRole('textbox').last().fill(name)
  await page.getByRole('textbox').last().press('Enter')
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

export async function openItem(page: Page, name: string) {
  await page.getByText(name, { exact: true }).click()
}

export async function openContextMenu(page: Page, itemName: string) {
  await page.getByText(itemName, { exact: true }).click({ button: 'right' })
}
