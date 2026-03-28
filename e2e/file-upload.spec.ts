import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Upload')
const testFileName = 'test-upload.txt'

test.describe.serial('file upload', () => {
  let testFilePath: string

  test.beforeAll(async ({ browser }) => {
    testFilePath = path.join(__dirname, testFileName)
    fs.writeFileSync(testFilePath, 'Test file content for E2E upload')

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
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath)
    }
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch (e) {
      console.warn('Cleanup: campaign deletion failed', e)
    }
    await page.close()
    await context.close()
  })

  test('upload file via dialog appears in sidebar', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const uploadButton = page.getByRole('button', {
      name: /upload|new file|add file/i,
    })
    await uploadButton.click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFilePath)

    const submitButton = page.getByRole('button', {
      name: /upload|submit|confirm/i,
    })
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click()
    }

    await expect(page.getByText(testFileName.replace('.txt', ''))).toBeVisible({
      timeout: 10000,
    })
  })

  test('click uploaded file loads viewer', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const fileItem = page.getByText(testFileName.replace('.txt', ''))
    await expect(fileItem).toBeVisible({ timeout: 5000 })
    await fileItem.click()
    await expect(
      page.locator(
        '[data-testid="file-viewer"], [data-testid="editor"], iframe, embed, img',
      ),
    ).toBeVisible({ timeout: 5000 })
  })
})
