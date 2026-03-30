import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createMap(page: Page, name: string) {
  await page.getByRole('button', { name: /map.*upload an image/i }).click()

  const textbox = page.getByRole('textbox', { name: 'Item name' })
  await expect(textbox).toHaveValue(/untitled/i, { timeout: 10000 })
  await textbox.click()
  await textbox.fill(name)
  await textbox.press('Enter')
  await expect(textbox).toHaveAttribute('readonly', '', { timeout: 5000 })

  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible({
    timeout: 10000,
  })
}

export async function openMap(page: Page, name: string) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await sidebar.getByRole('link', { name, exact: true }).click()
  await page.waitForLoadState('networkidle')
}

export async function uploadMapImage(page: Page, imagePath: string) {
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(imagePath)
  await expect(page.locator('[aria-label="Map canvas"]')).toBeVisible({
    timeout: 15000,
  })
}
