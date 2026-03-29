import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

test.skip(!process.env.E2E_PLAYER_EMAIL, 'Requires E2E_PLAYER_EMAIL env var')

const campaignName = testName('E2E ViewAs')
let sharedNote: string
let unsharedNote: string

test.describe.serial('view-as-player', () => {
  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    sharedNote = `Shared ${id}-1`
    unsharedNote = `Unshared ${id}-2`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, sharedNote)
    await createNote(page, unsharedNote)
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

  test('share one note with all players', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, sharedNote)

    const shareButton = page.getByRole('button', { name: /share/i })
    await shareButton.click()

    const sharePopover = page.locator('[data-slot="popover-content"]')
    await expect(sharePopover).toBeVisible({ timeout: 5000 })

    const allPlayersRow = sharePopover
      .locator('div')
      .filter({ hasText: /^All Players/ })
      .filter({ has: page.locator('[data-slot="select-trigger"]') })
    const permSelect = allPlayersRow.locator('[data-slot="select-trigger"]')
    await expect(permSelect).toContainText(/none/i, { timeout: 5000 })
    await permSelect.click()
    await page
      .getByRole('option', { name: /^view$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('view-as all players shows only shared note', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const viewAsButton = page.getByRole('button', { name: /view as/i })
    await expect(viewAsButton).toBeVisible()
    await viewAsButton.click()

    await page.getByText(/all players/i).click()

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar.getByRole('link', { name: sharedNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      sidebar.getByRole('link', { name: unsharedNote, exact: true }),
    ).not.toBeVisible()
  })

  test('switching back to DM view shows both notes', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // May already be in view-as mode from previous test or need to toggle
    const viewAsButton = page.getByRole('button', {
      name: /view as|stop viewing/i,
    })
    await viewAsButton.click()

    const stopOption = page.getByText(/stop|dm|dungeon master/i)
    try {
      await expect(stopOption).toBeVisible({ timeout: 3000 })
      await stopOption.click()
    } catch {
      /* stop option not present */
    }

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar.getByRole('link', { name: sharedNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      sidebar.getByRole('link', { name: unsharedNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })
  })
})
