import { expect, test } from '@playwright/test'
import {
  createCampaign,
  deleteCampaign,
  navigateToCampaign,
} from './helpers/campaign-helpers'
import { createFolder, openContextMenu } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('E2E Folders')
let parentFolder: string
let childNote: string

async function setFolderExpansion(
  page: Page,
  folderName: string,
  expand: boolean,
) {
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  const folderLink = sidebar.getByRole('link', {
    name: folderName,
    exact: true,
  })
  await folderLink.hover()
  const folderRow = folderLink.locator('..')
  const chevron = folderRow.getByRole('button', {
    name: /expand folder|collapse folder/i,
  })
  const label = await chevron.getAttribute('aria-label')
  const isExpanded = /collapse/i.test(label ?? '')
  if (isExpanded !== expand) {
    await chevron.click()
  }
}

test.describe.serial('folder nesting and expand/collapse', () => {
  test.use({ storageState: AUTH_STORAGE_PATH })

  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    parentFolder = `Parent ${id}`
    childNote = `Child ${id}`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createFolder(page, parentFolder)
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

  test('create child note inside folder via context menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await openContextMenu(page, parentFolder)
    await page.getByRole('menuitem', { name: 'New...' }).hover()
    await page.getByRole('menuitem', { name: 'Note' }).click()

    const nameInput = page.getByRole('textbox', { name: 'Item name' })
    await expect(nameInput).toHaveValue(/untitled/i, { timeout: 10000 })
    await nameInput.click()
    await nameInput.fill(childNote)
    await nameInput.press('Enter')

    // Expand folder to verify child is inside
    await setFolderExpansion(page, parentFolder, true)
    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('collapse and expand folder toggles child visibility', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    // Expand folder first
    await setFolderExpansion(page, parentFolder, true)
    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })

    // Collapse folder — child should hide
    await setFolderExpansion(page, parentFolder, false)
    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).not.toBeVisible({ timeout: 10000 })

    // Expand folder again — child should reappear
    await setFolderExpansion(page, parentFolder, true)
    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('close all folders hides child', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    // Expand folder first so child is visible
    await setFolderExpansion(page, parentFolder, true)
    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Close all folders' }).click()

    await expect(
      sidebar.getByRole('link', { name: childNote, exact: true }),
    ).not.toBeVisible({ timeout: 10000 })
  })
})
