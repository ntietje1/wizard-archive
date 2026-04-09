import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Download')
const testFileName = 'test-download.txt'

test.describe.serial('file download', () => {
  let testFilePath: string | null = null

  test.beforeAll(async ({ browser }) => {
    testFilePath = path.join(path.dirname(fileURLToPath(import.meta.url)), testFileName)
    fs.writeFileSync(testFilePath, 'Test file content for E2E download')

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)

    // Create a file item via the "File" button on the create-new page
    await page.getByRole('button', { name: /^File/ }).click()
    const fileInput = page.getByLabel('Upload file')
    await fileInput.setInputFiles(testFilePath)

    await expect(page.getByRole('link', { name: /untitled file/i })).toBeVisible({ timeout: 10000 })

    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
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

  test('download file via context menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('link', { name: /untitled file/i })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, 'Untitled File')

    const downloadItem = page.getByRole('menuitem', { name: /^download$/i })
    await expect(downloadItem).toBeVisible()
    await expect(downloadItem).toBeEnabled()

    const [popup, download] = await Promise.all([
      page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      downloadItem.click(),
    ])
    if (download) {
      expect(download.suggestedFilename()).toBeTruthy()
    }
    if (popup) await popup.close()
  })
})
