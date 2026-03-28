import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createCampaign(page: Page, name: string) {
  await page.waitForLoadState('networkidle')
  await page
    .getByRole('button', { name: /new campaign|create.*campaign/i })
    .first()
    .click()

  await page.getByLabel(/campaign name/i).fill(name)
  await page.getByRole('button', { name: /^create campaign$/i }).click()
  await expect(
    page.getByRole('dialog', { name: /new campaign/i }),
  ).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })
}

export async function navigateToCampaign(page: Page, campaignName: string) {
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\//)
}

export async function deleteCampaign(page: Page, name: string) {
  const card = page.locator('a', { hasText: name }).locator('..')
  await card.getByRole('button', { name: /delete campaign/i }).click()
  const dialog = page.getByRole('dialog', { name: /delete campaign/i })
  await dialog.getByRole('button', { name: /^delete/i }).click()
  await expect(dialog).not.toBeVisible()
}
