import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export function getSearchDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Search' })
}

export function getSearchInput(page: Page) {
  return page.getByRole('combobox', { name: 'Search' })
}

export function getResultsList(page: Page) {
  return page.getByRole('listbox', { name: 'Search results' })
}

export function getResultItems(page: Page) {
  return getResultsList(page).getByRole('option')
}

export function getSelectedResult(page: Page) {
  return getResultsList(page).getByRole('option', { selected: true })
}

export function getStatusText(page: Page) {
  return getSearchDialog(page).getByRole('status')
}

export async function openSearchDialog(page: Page) {
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(getSearchDialog(page)).toBeVisible({ timeout: 5000 })
}

export async function openSearchWithKeyboard(page: Page) {
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible({
    timeout: 10000,
  })
  await page.keyboard.press('Control+k')
  await expect(getSearchDialog(page)).toBeVisible({ timeout: 5000 })
}

export async function closeSearchWithKeyboard(page: Page) {
  await page.keyboard.press('Escape')
  await expect(getSearchDialog(page)).not.toBeVisible({ timeout: 5000 })
}

export async function typeSearch(page: Page, text: string) {
  const input = getSearchInput(page)
  await input.fill(text)
}

export async function waitForResults(page: Page) {
  await page.waitForTimeout(500)
}

export async function expectResultCount(page: Page, count: number) {
  const status = getStatusText(page)
  if (count === 0) {
    await expect(status).toHaveText('No results', { timeout: 5000 })
  } else {
    const label = count === 1 ? '1 result' : `${count} results`
    await expect(status).toHaveText(label, { timeout: 5000 })
  }
}

export async function expectResultWithText(
  page: Page,
  text: string,
  timeout = 10000,
): Promise<Locator> {
  const item = getResultItems(page).filter({ hasText: text })
  await expect(item.first()).toBeVisible({ timeout })
  return item.first()
}
