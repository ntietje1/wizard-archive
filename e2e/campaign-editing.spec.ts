import { expect, test } from '@playwright/test'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { deleteCampaignById, provisionCampaign } from './helpers/campaign-helpers'
import { testName } from './helpers/constants'

const campaignName = testName('CampEdit')
let updatedName: string
let updatedDescription: string
let campaignId: CampaignId

test.describe.serial('campaign editing', () => {
  test.beforeAll(async () => {
    const ts = Date.now()
    updatedName = `Updated ${ts}`
    updatedDescription = `Description updated at ${ts}`

    campaignId = await provisionCampaign(campaignName)
  })

  test.afterAll(async () => {
    if (campaignId) await deleteCampaignById(campaignId)
  })

  test('edit campaign name and description', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await expect(page.getByText(campaignName)).toBeVisible({ timeout: 10000 })

    const card = page.getByRole('article', { name: campaignName })
    await card.getByRole('button', { name: /edit campaign/i }).click()

    await expect(page.getByRole('heading', { name: /edit campaign/i })).toBeVisible({
      timeout: 10000,
    })

    const nameField = page.getByLabel(/campaign name/i)
    await nameField.fill(updatedName)

    const descField = page.getByLabel(/description/i)
    await descField.fill(updatedDescription)

    await page.getByRole('button', { name: /update campaign/i }).click()

    await expect(page.getByRole('heading', { name: /edit campaign/i })).not.toBeVisible({
      timeout: 10000,
    })

    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })
  })

  test('updated name persists after reload', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await expect(page.getByText(updatedName)).toBeVisible({ timeout: 10000 })
  })
})
