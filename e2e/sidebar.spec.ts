import { expect, test } from '@playwright/test'
import { deleteCampaign } from './helpers/campaign-helpers'
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
    await page.getByRole('button', { name: /new campaign|create/i }).click()
    await page.getByLabel('Name').fill(campaignName)
    await page.getByRole('button', { name: /create/i }).click()
    await expect(page.getByText(campaignName)).toBeVisible()
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
    await expect(page.getByText(folderName)).toBeVisible()
    await createNote(page, noteName)
    await expect(page.getByText(noteName)).toBeVisible()
  })

  test('context menu shows expected actions', async ({ page }) => {
    await page.goto('/campaigns')
    await page.getByText(campaignName).click()
    await page.waitForURL(/\/campaigns\//)
    await expect(page.getByText(noteName)).toBeVisible()
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
    await expect(page.getByText(noteName)).toBeVisible()
    await openContextMenu(page, noteName)
    await page.getByText(/rename/i).click()
    const renamedName = `Renamed ${Date.now()}`
    const renameInput = page.getByRole('textbox', { name: /name/i })
    await renameInput.fill(renamedName)
    await renameInput.press('Enter')
    await expect(page.getByText(renamedName)).toBeVisible()
  })
})
