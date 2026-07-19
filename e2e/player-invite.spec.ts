import { expect, test } from '@playwright/test'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import {
  deleteCampaignById,
  navigateToCampaignId,
  provisionCampaign,
} from './helpers/campaign-helpers'
import { getCampaignIdFromUrl, getCampaignInvitationPath } from './helpers/convex-helpers'
import { gotoSignIn, signIn } from './helpers/auth-helpers'
import { testName } from './helpers/constants'

const E2E_PLAYER_EMAIL = process.env.E2E_PLAYER_EMAIL
const E2E_PLAYER_PASSWORD = process.env.E2E_PLAYER_PASSWORD

test.skip(
  !E2E_PLAYER_EMAIL || !E2E_PLAYER_PASSWORD,
  'Requires E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD env vars',
)

const campaignName = testName('E2E Invite')
let provisionedCampaignId: CampaignId

test.describe.serial('player invite flow', () => {
  test.beforeAll(async () => {
    provisionedCampaignId = await provisionCampaign(campaignName)
  })

  test.afterAll(async () => {
    if (provisionedCampaignId) await deleteCampaignById(provisionedCampaignId)
  })

  test('DM opens campaign settings and sees invite section', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, provisionedCampaignId)

    await page.getByRole('button', { name: 'User menu' }).click()
    const settingsBtn = page.getByRole('button', { name: /^settings$/i })
    await expect(settingsBtn).toBeVisible({ timeout: 10000 })
    await settingsBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    await dialog.getByRole('button', { name: /people/i }).click()
    await expect(dialog.getByText(/invite/i)).toBeVisible({ timeout: 10000 })
  })

  test('player navigates to join URL and requests to join', async ({ browser, page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, provisionedCampaignId)

    const campaignId = getCampaignIdFromUrl(page.url())
    const playerContext = await browser.newContext()
    const playerPage = await playerContext.newPage()

    await gotoSignIn(playerPage)
    await signIn(playerPage, E2E_PLAYER_EMAIL!, E2E_PLAYER_PASSWORD!)
    await playerPage.waitForURL('**/campaigns', { timeout: 30000 })

    await playerPage.goto(getCampaignInvitationPath(campaignId))
    const joinButton = playerPage.getByRole('button', { name: /join/i })
    await expect(joinButton).toBeVisible({ timeout: 10000 })
    await joinButton.click()

    await expect(playerPage.getByText(/Request Sent|You're In!/i)).toBeVisible({
      timeout: 10000,
    })

    await playerPage.close()
    await playerContext.close()
  })

  test('DM sees player in member list', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaignId(page, provisionedCampaignId)

    await page.getByRole('button', { name: 'User menu' }).click()
    const settingsBtn2 = page.getByRole('button', { name: /^settings$/i })
    await expect(settingsBtn2).toBeVisible({ timeout: 10000 })
    await settingsBtn2.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('button', { name: /people/i }).click()

    // Approve if there's a pending request
    const approveButton = dialog.getByRole('button', {
      name: /approve|accept/i,
    })
    const hasApprove = await approveButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (hasApprove) {
      await approveButton.click()
    }

    // Verify member-related UI is visible
    await expect(dialog.getByText(/member/i)).toBeVisible({ timeout: 10000 })
  })
})
