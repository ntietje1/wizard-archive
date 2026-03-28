import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createCampaign(page: Page, name: string) {
  await page.getByRole('button', { name: /new campaign|create/i }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: /create/i }).click()
  await expect(page.getByText(name)).toBeVisible()
}

export async function navigateToCampaign(page: Page, campaignName: string) {
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\//)
}

export async function deleteCampaign(page: Page, name: string) {
  const card = page.locator('[data-testid="campaign-card"]', { hasText: name })
  await card.getByRole('button', { name: /delete|more/i }).click()
  await page.getByRole('menuitem', { name: /delete/i }).click()
  await page.getByRole('button', { name: /confirm|delete/i }).click()
  await expect(page.getByText(name)).not.toBeVisible()
}
