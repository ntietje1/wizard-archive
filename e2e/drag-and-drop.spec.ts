import { test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E DnD')
const noteName = `DnD Note ${Date.now()}`
const folderName = `DnD Folder ${Date.now()}`

test.describe.serial('drag and drop', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createFolder(page, folderName)
    await createNote(page, noteName)
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

  test.fixme('drag note into folder', async ({ page: _page }) => {
    // Custom DnD system using pointer events requires further investigation
    // for reliable automation
  })
})
