import { test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createNote, openItem } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

test.skip(!process.env.E2E_PLAYER_EMAIL, 'Requires E2E_PLAYER_EMAIL env var')

const campaignName = testName('E2E BlockShare')

test.describe.serial('block-level sharing', () => {
  test.use({ storageState: AUTH_STORAGE_PATH })

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
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

  test.fixme('share specific blocks with players', async ({ page }) => {
    // Block-level share UI automation with BlockNote's side menu
    // needs further investigation into the exact DOM structure and
    // interaction pattern for selecting individual blocks and toggling
    // their share state.
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const noteName = `BlockNote ${Date.now()}`
    await createNote(page, noteName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await editor.click()
    await page.keyboard.type('Shared paragraph')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Private paragraph')
  })
})
