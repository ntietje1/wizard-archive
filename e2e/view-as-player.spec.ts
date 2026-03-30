import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { signIn } from './helpers/auth-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { openSettingsPeopleTab } from './helpers/permission-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

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

    // Extract campaign URL info for the join link
    const url = page.url()
    const match = url.match(/\/campaigns\/([^/]+)\/([^/]+)/)
    if (!match) {
      throw new Error(`Unexpected campaign URL format: ${url}`)
    }
    const [, dmUsername, campaignSlug] = match

    await page.close()
    await context.close()

    // Sign in as player and join the campaign
    const playerContext = await browser.newContext()
    const playerPage = await playerContext.newPage()
    await playerPage.goto('/sign-in', { waitUntil: 'networkidle' })
    await signIn(playerPage, E2E_PLAYER_EMAIL!, E2E_PLAYER_PASSWORD!)
    await playerPage.waitForURL('**/campaigns', { timeout: 30000 })
    await playerPage.goto(`/join/${dmUsername}/${campaignSlug}`)
    const joinButton = playerPage.getByRole('button', { name: /join/i })
    await expect(joinButton).toBeVisible({ timeout: 10000 })
    await joinButton.click()
    await expect(playerPage.getByText(/Request Sent|You're In!/i)).toBeVisible({
      timeout: 10000,
    })
    await playerPage.close()
    await playerContext.close()

    // DM approves the join request
    const dmContext = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const dmPage = await dmContext.newPage()
    await dmPage.goto('/campaigns')
    await navigateToCampaign(dmPage, campaignName)
    const dialog = await openSettingsPeopleTab(dmPage)
    const playerRow = dialog.locator('div').filter({
      hasText: new RegExp(E2E_PLAYER_EMAIL!, 'i'),
    })
    const approveButton = playerRow.getByRole('button', {
      name: /approve|accept/i,
    })
    const hasApprove = await approveButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (hasApprove) {
      await approveButton.click()
    }
    await dmPage.close()
    await dmContext.close()
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

    const shareButton = page.getByRole('button', { name: /^private|^shared/i })
    await shareButton.click()

    const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' })
    await expect(shareDialog).toBeVisible({ timeout: 5000 })

    const permSelect = shareDialog
      .getByRole('combobox')
      .filter({ hasNotText: /full access/i })
    await expect(permSelect).toContainText(/none/i, { timeout: 5000 })
    await permSelect.click()
    await page
      .getByRole('option', { name: /^view$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('view-as player shows only shared note', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const viewAsButton = page.getByRole('button', { name: /view as/i })
    await expect(viewAsButton).toBeVisible()
    await viewAsButton.click()

    const playerUsername = E2E_PLAYER_EMAIL!.split('@')[0]
    const playerItem = page.getByRole('menuitemcheckbox', {
      name: new RegExp(playerUsername, 'i'),
    })
    await expect(playerItem).toBeVisible({ timeout: 5000 })
    await playerItem.click()

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
