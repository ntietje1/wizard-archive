import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createCampaign(page: Page, name: string) {
  const newCampaignButton = page
    .getByRole('button', {
      name: /new campaign|create.*campaign|first campaign/i,
    })
    .first()
  await expect(newCampaignButton).toBeVisible({ timeout: 10000 })
  await newCampaignButton.click()

  const nameInput = page.getByLabel(/campaign name/i)
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill(name)
  await nameInput.press('Tab')
  const createBtn = page.getByRole('button', { name: /^create campaign$/i })
  await expect(createBtn).toBeEnabled({ timeout: 5000 })
  await createBtn.click()
  await expect(
    page.getByRole('dialog', { name: /new campaign/i }),
  ).not.toBeVisible({ timeout: 15000 })
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 })
}

export async function navigateToCampaign(page: Page, campaignName: string) {
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\//)
}

export async function deleteCampaign(page: Page, name: string) {
  const card = page.getByRole('article', { name })
  await card.getByRole('button', { name: /delete campaign/i }).click()
  const dialog = page.getByRole('dialog', { name: /delete campaign/i })
  await dialog.getByRole('button', { name: /^delete/i }).click()
  await expect(dialog).not.toBeVisible()
}
