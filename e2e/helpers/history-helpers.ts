import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function openHistoryPanel(page: Page) {
  await page.getByRole('button', { name: /toggle history panel/i }).click()
  await expect(page.getByText(/loading history|no history yet|created this item/i)).toBeVisible({
    timeout: 10000,
  })
}

export function getHistoryEntry(page: Page, text: string | RegExp) {
  return page.getByTestId('history-panel').getByText(text)
}

export function getClickableHistoryEntry(page: Page, text: string | RegExp) {
  return page.getByTestId('history-panel').getByRole('button').filter({ hasText: text })
}

export async function waitForHistoryEntry(page: Page, text: string | RegExp) {
  await expect(getHistoryEntry(page, text).first()).toBeVisible({
    timeout: 25000,
  })
}

export async function clickHistoryEntry(page: Page, text: string | RegExp) {
  await getClickableHistoryEntry(page, text).first().click()
  await expect(page.getByText(/previewing version from/i)).toBeVisible({
    timeout: 10000,
  })
}

export async function exitPreview(page: Page) {
  await page.getByRole('button', { name: 'Exit' }).click()
  await expect(page.getByText(/previewing version from/i)).not.toBeVisible({
    timeout: 5000,
  })
}

export async function restoreFromPreview(page: Page) {
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByText(/version restored/i)).toBeVisible({
    timeout: 10000,
  })
}
