import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E CtxMenu')
const noteName = `Ctx Note ${Date.now()}`
const folderName = `Ctx Folder ${Date.now()}`
const testFileName = 'ctx-test-upload.txt'

test.describe.serial('context menu completeness', () => {
  let testFilePath: string

  test.beforeAll(async ({ browser }) => {
    testFilePath = path.join(os.tmpdir(), testFileName)
    fs.writeFileSync(testFilePath, 'Context menu test file')

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    await createFolder(page, folderName)

    await page.getByRole('link', { name: 'New' }).click()
    await page.getByRole('button', { name: /^File/ }).click()
    const fileInput = page.getByLabel('Upload file')
    await fileInput.setInputFiles(testFilePath)
    await expect(page.getByRole('link', { name: /untitled file/i })).toBeVisible({ timeout: 10000 })

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
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('note context menu has expected items', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, noteName)

    const expectedItems = ['Open', 'Bookmark', 'Download', 'Rename', 'Edit Note', 'Move to Trash']
    for (const item of expectedItems) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    }

    await page.keyboard.press('Escape')
  })

  test('folder context menu has expected items', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: folderName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, folderName)

    const expectedItems = [
      'Open',
      'Bookmark',
      'New...',
      'Download',
      'Rename',
      'Edit Folder',
      'Move to Trash',
    ]
    for (const item of expectedItems) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    }

    await page.keyboard.press('Escape')
  })

  test('file context menu has expected items', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const fileLink = page.getByRole('link', { name: /untitled file/i })
    await expect(fileLink).toBeVisible({ timeout: 10000 })

    await fileLink.click({ button: 'right' })

    const expectedItems = ['Open', 'Bookmark', 'Download', 'Rename', 'Edit File', 'Move to Trash']
    for (const item of expectedItems) {
      await expect(page.getByRole('menuitem', { name: item })).toBeVisible()
    }

    await page.keyboard.press('Escape')
  })

  test('move to trash from context menu works', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await expect(page.getByRole('link', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, noteName)
    await page.getByRole('menuitem', { name: 'Move to Trash' }).click()

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('link', { name: noteName, exact: true })).not.toBeVisible({
      timeout: 10000,
    })
  })

  test('download menuitem is clickable for file', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const fileLink = page.getByRole('link', { name: /untitled file/i })
    await expect(fileLink).toBeVisible({ timeout: 10000 })

    await fileLink.click({ button: 'right' })

    const downloadItem = page.getByRole('menuitem', { name: 'Download' })
    await expect(downloadItem).toBeVisible()
    await expect(downloadItem).toBeEnabled()
    await page.keyboard.press('Escape')
  })
})
