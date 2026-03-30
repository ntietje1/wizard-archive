import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E FileTypes')
const testDir = path.dirname(fileURLToPath(import.meta.url))

test.describe.serial('file type handling', () => {
  let pngPath = ''
  let pdfPath = ''
  let oversizedPath = ''

  test.beforeAll(async ({ browser }) => {
    // Create test PNG (minimal valid 1x1 PNG)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    const ihdr = Buffer.from([
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00,
    ])
    const idat = Buffer.from([
      0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33,
    ])
    const iend = Buffer.from([
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])
    pngPath = path.join(testDir, 'test-image.png')
    fs.writeFileSync(pngPath, Buffer.concat([pngHeader, ihdr, idat, iend]))

    // Create minimal PDF
    const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
190
%%EOF`
    pdfPath = path.join(testDir, 'test-document.pdf')
    fs.writeFileSync(pdfPath, pdfContent)

    // Create oversized file (>10MB) with valid extension
    oversizedPath = path.join(testDir, 'test-oversized.txt')
    const buf = Buffer.alloc(11 * 1024 * 1024, 0x41)
    fs.writeFileSync(oversizedPath, buf)

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
    for (const p of [pngPath, pdfPath, oversizedPath]) {
      if (p && fs.existsSync(p)) fs.unlinkSync(p)
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

  test('upload image file shows preview', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await page.getByRole('button', { name: /^file upload/i }).click()
    await page.getByLabel('Upload file').setInputFiles(pngPath)

    await expect(
      page.getByRole('link', { name: /untitled file/i }),
    ).toBeVisible({ timeout: 15000 })

    await page
      .getByRole('link', { name: /untitled file/i })
      .first()
      .click()

    await expect(page.locator('[title="Zoom In"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('upload PDF file', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await page.getByRole('button', { name: /^file upload/i }).click()
    await expect(page.getByLabel('Upload file')).toBeAttached({
      timeout: 15000,
    })
    await page.getByLabel('Upload file').setInputFiles(pdfPath)

    // Second file upload creates "Untitled File 2"
    await expect(
      page.getByRole('link', { name: /untitled file 2/i }),
    ).toBeVisible({ timeout: 15000 })
  })

  test('oversized file shows error', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await page.getByRole('button', { name: /^file upload/i }).click()
    await page.getByLabel('Upload file').setInputFiles(oversizedPath)

    await expect(
      page.getByText(/file must be less than|too large|size limit/i),
    ).toBeVisible({ timeout: 10000 })
  })
})
