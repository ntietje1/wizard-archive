import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import {
  deleteCampaignById,
  navigateToCampaignId,
  provisionCampaign,
} from './helpers/campaign-helpers'
import { testName } from './helpers/constants'
import { createNamedResource, sidebarResource } from './helpers/editor-resource-helpers'

const campaignName = testName('File Lifecycle')
let campaignId: CampaignId

test.describe.serial('canonical file lifecycle', () => {
  test.beforeAll(async () => {
    campaignId = await provisionCampaign(campaignName)
  })

  test.afterAll(async () => {
    if (campaignId) await deleteCampaignById(campaignId)
  })

  test.beforeEach(async ({ page }) => {
    await navigateToCampaignId(page, campaignId)
  })

  test('uploads, views, downloads, and replaces exact file bytes', async ({ page }) => {
    await uploadFile(page, 'evidence.txt', 'text/plain', Buffer.from('original evidence'))
    await sidebarResource(page, 'evidence.txt').click()
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
    await sidebarResource(page, 'token.png').click()
    await expect(page.getByRole('img', { name: 'token.png' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()

    const document = await PDFDocument.create()
    document.addPage([612, 792])
    await uploadFile(page, 'rules.pdf', 'application/pdf', Buffer.from(await document.save()))
    await sidebarResource(page, 'rules.pdf').click()
    await expect(page.getByText('Page 1 of 1')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  })
})

async function uploadFile(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await createNamedResource(page, 'File', name)
  const file = page.getByLabel('File content')
  await expect(file).toBeVisible({ timeout: 15_000 })
  await file.getByLabel('Choose file replacement').setInputFiles({ name, mimeType, buffer })
  await expect(file.getByRole('link', { name: 'Download', exact: true })).toBeVisible({
    timeout: 15_000,
  })
}

async function downloadText(file: Locator): Promise<string> {
  const started = file.page().waitForEvent('download')
  await file.getByRole('link', { name: 'Download', exact: true }).click()
  const download = await started
  const path = await download.path()
  if (!path) throw new Error('Downloaded file is unavailable')
  return await readFile(path, 'utf8')
}
