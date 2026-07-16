import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('File Lifecycle')

test.describe.serial('canonical file lifecycle', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      // Cleanup is best-effort so a failed assertion keeps its original evidence.
    }
    await context.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
  })

  test('uploads, views, downloads, and replaces exact file bytes', async ({ page }) => {
    await uploadFile(page, 'evidence.txt', 'text/plain', Buffer.from('original evidence'))
    await page.getByRole('button', { name: 'evidence.txt', exact: true }).click()
    const file = page.getByLabel('File content')
    await expect(file).toBeVisible()
    await expect(file).toContainText('This file type cannot be previewed.')

    expect(await downloadText(file)).toBe('original evidence')

    const originalUrl = await file
      .getByRole('link', { name: 'Download', exact: true })
      .getAttribute('href')
    await file.getByLabel('Choose file replacement').setInputFiles({
      name: 'replacement.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('replacement evidence'),
    })
    await expect
      .poll(() => file.getByRole('link', { name: 'Download', exact: true }).getAttribute('href'))
      .not.toBe(originalUrl)

    expect(await downloadText(file)).toBe('replacement evidence')
  })

  test('renders inspected image and PDF content through canonical viewers', async ({ page }) => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xn2rAAAAAElFTkSuQmCC',
      'base64',
    )
    await uploadFile(page, 'token.png', 'image/png', png)
    await page.getByRole('button', { name: 'token.png', exact: true }).click()
    await expect(page.getByRole('img', { name: 'token.png' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()

    const document = await PDFDocument.create()
    document.addPage([612, 792])
    await uploadFile(page, 'rules.pdf', 'application/pdf', Buffer.from(await document.save()))
    await page.getByRole('button', { name: 'rules.pdf', exact: true }).click()
    await expect(page.getByText('Page 1 of 1')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  })

  test('rejects unsupported and oversized files before reading them', async ({ page }) => {
    await page.getByRole('button', { name: 'Create resource', exact: true }).click()
    const input = page.getByLabel('Create resource: choose file')
    await input.setInputFiles({
      name: 'payload.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not executable code'),
    })
    await expect(page.getByText('Please upload a valid file type')).toBeVisible()

    await page.getByRole('button', { name: 'Create resource', exact: true }).click()
    await page.getByLabel('Create resource: choose file').evaluate((element) => {
      const file = new File(['small'], 'oversized.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 100 * 1024 * 1024 + 1 })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      const fileInput = element as HTMLInputElement
      fileInput.files = transfer.files
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(page.getByText('File must be less than 100MB')).toBeVisible()
    await expect(page.getByRole('button', { name: 'payload.exe', exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: 'oversized.txt', exact: true })).toBeHidden()
  })
})

async function uploadFile(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByLabel('Create resource: choose file').setInputFiles({ name, mimeType, buffer })
  await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible({ timeout: 15_000 })
}

async function downloadText(file: Locator): Promise<string> {
  const started = file.page().waitForEvent('download')
  await file.getByRole('link', { name: 'Download', exact: true }).click()
  const download = await started
  const path = await download.path()
  if (!path) throw new Error('Downloaded file is unavailable')
  return await readFile(path, 'utf8')
}
