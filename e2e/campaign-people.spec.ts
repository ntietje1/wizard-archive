import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { openSettingsPeopleTab } from './helpers/permission-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E People')

test.describe.serial('campaign people management', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('view members list in people tab', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const dialog = await openSettingsPeopleTab(page)

    // DM should be listed as a member
    await expect(dialog.getByText(/members/i).first()).toBeVisible()
  })

  test('invite link section is visible', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const dialog = await openSettingsPeopleTab(page)

    // Should show invite link or invite section
    await expect(dialog.getByText(/invite|join link/i).first()).toBeVisible({
      timeout: 5000,
    })
  })

  test('accept pending request if available', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const dialog = await openSettingsPeopleTab(page)

    const acceptButton = dialog.getByRole('button', { name: /^accept$/i })
    const isVisible = await acceptButton
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    if (isVisible) {
      await acceptButton.first().click()
      await expect(acceptButton.first()).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('reject pending request if available', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

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
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

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
