import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign } from './helpers/campaign-helpers'
import {
  createFolder,
  createNote,
  openContextMenu,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Sidebar')
const folderName = `Folder ${Date.now()}`
const noteName = `Note ${Date.now()}`

test.describe.serial('sidebar operations', () => {
  test.beforeAll(async ({ browser }) => {
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

  test('create folder and note', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await createFolder(page, folderName)
    await expect(
      page.getByRole('link', { name: folderName, exact: true }),
    ).toBeVisible()
    await createNote(page, noteName)
    await expect(
      page.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible()
  })

  test('context menu shows expected actions', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(
      page.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible()
    await openContextMenu(page, noteName)
    await expect(page.getByRole('menuitem', { name: /rename/i })).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /delete|trash/i }),
    ).toBeVisible()
  })

  test('rename via context menu', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(
      page.getByRole('link', { name: noteName, exact: true }),
    ).toBeVisible()
    await openContextMenu(page, noteName)
    await page.getByText(/rename/i).click()
    const renamedName = `Renamed ${Date.now()}`
    const renameInput = page.getByRole('textbox', { name: /enter a name/i })
    await renameInput.fill(renamedName)
    await renameInput.press('Enter')
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(
      sidebar.getByRole('link', { name: renamedName, exact: true }),
    ).toBeVisible()
  })
})
