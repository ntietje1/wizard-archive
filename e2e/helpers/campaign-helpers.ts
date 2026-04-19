import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function createCampaign(page: Page, name: string) {
  const newCampaignButton = page
    .getByRole('button', {
      name: /new campaign|create.*campaign|first campaign/i,
    })
    .first()
  await expect(newCampaignButton).toBeVisible({ timeout: 30000 })
  await newCampaignButton.click()

  const nameInput = page.getByLabel(/campaign name/i)
  await expect(nameInput).toBeVisible({ timeout: 5000 })
  await nameInput.fill(name)

  const slugInput = page.getByLabel(/custom link/i)
  await expect(slugInput).toHaveValue(/^[a-z0-9-]{6,30}$/, { timeout: 5000 })
  // Blur the inputs so the app finishes auto-slug generation and validation before submit.
  await nameInput.press('Tab')
  await slugInput.press('Tab')
  const createBtn = page.getByRole('button', { name: /^create campaign$/i })
  await expect(createBtn).toBeEnabled({ timeout: 10000 })
  await createBtn.click()
  await expect(page.getByRole('dialog', { name: /new campaign/i })).not.toBeVisible({
    timeout: 30000,
  })
  await expect(page.getByRole('article', { name })).toBeVisible({ timeout: 15000 })
}

export async function navigateToCampaign(page: Page, campaignName: string) {
  await page.getByText(campaignName, { exact: true }).click()
  await page.waitForURL(/\/campaigns\//)
}

export async function deleteCampaign(page: Page, name: string) {
  const card = page.getByRole('article', { name })
  await expect(card).toBeVisible({ timeout: 15000 })
  await card.getByRole('button', { name: /delete campaign/i }).click()
  const dialog = page.getByRole('dialog', { name: /delete campaign/i })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^delete/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
}
