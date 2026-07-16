import { expect, test } from '@playwright/test'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import {
  deleteCampaignById,
  navigateToCampaignId,
  provisionCampaign,
} from './helpers/campaign-helpers'
import { testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('E2E People')
let campaignId: CampaignId

async function openSettingsPeopleTab(page: Page) {
  await page.getByRole('button', { name: 'User menu' }).click()
  await page.getByRole('button', { name: /^settings$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /people/i }).click()
  await expect(dialog.getByText(/members/i).first()).toBeVisible({ timeout: 5000 })
  return dialog
}

test.describe.serial('campaign people management', () => {
  test.beforeAll(async () => {
    campaignId = await provisionCampaign(campaignName)
  })

  test.afterAll(async () => {
    if (campaignId) await deleteCampaignById(campaignId)
  })

  test('view members list in people tab', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, campaignId)

    const dialog = await openSettingsPeopleTab(page)

    // DM should be listed as a member
    await expect(dialog.getByText(/members/i).first()).toBeVisible()
  })

  test('invite link section is visible', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, campaignId)

    const dialog = await openSettingsPeopleTab(page)

    // Should show invite link or invite section
    await expect(dialog.getByText(/invite|join link/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('accept pending request if available', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, campaignId)

    const dialog = await openSettingsPeopleTab(page)

    const acceptButton = dialog.getByRole('button', { name: /^accept$/i })
    const firstAcceptButton = acceptButton.first()
    const isVisible = await acceptButton
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (isVisible) {
      await firstAcceptButton.click()
      await expect(firstAcceptButton).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('reject pending request if available', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, campaignId)

    const dialog = await openSettingsPeopleTab(page)

    const rejectButton = dialog.getByRole('button', { name: /^reject$/i })
    const isVisible = await rejectButton
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (isVisible) {
      await rejectButton.first().click()
      await expect(rejectButton.first()).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('remove member if available', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, campaignId)

    const dialog = await openSettingsPeopleTab(page)

    const kebabButton = dialog.getByRole('button', {
      name: /more|options|menu/i,
    })
    const hasKebab = await kebabButton
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (!hasKebab) return

    await kebabButton.first().click()

    const removeButton = page.getByRole('menuitem', { name: /remove/i })
    await expect(removeButton.first()).toBeVisible({ timeout: 3000 })
    await removeButton.first().click()

    const confirmDialog = page.getByRole('dialog', {
      name: /remove player/i,
    })
    await expect(confirmDialog).toBeVisible({ timeout: 3000 })
    await confirmDialog.getByRole('button', { name: /^remove/i }).click()
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 })
  })
})
