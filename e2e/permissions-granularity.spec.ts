import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote, openItem } from './helpers/sidebar-helpers'
import { openShareMenu } from './helpers/permission-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import type { Page } from '@playwright/test'

const campaignName = testName('E2E Perms')
let folderName: string
let noteName: string

function allPlayersRow(page: Page) {
  return page.getByTestId('share-all-players-row')
}

test.describe.serial('permissions granularity', () => {
  test.beforeAll(async ({ browser }) => {
    const id = Date.now()
    folderName = `Perm Folder ${id}`
    noteName = `Perm Note ${id}`

    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
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
    await page.goto('/campaigns', { waitUntil: 'commit' })
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('open share menu shows permission controls', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)
    await openShareMenu(page)

    await expect(page.getByText(`Share "${noteName}"`)).toBeVisible()
    await expect(allPlayersRow(page).locator('[data-slot="select-trigger"]')).toBeVisible()
  })

  test('set all-players permission to View', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)
    await openShareMenu(page)

    const row = allPlayersRow(page)
    const permSelect = row.locator('[data-slot="select-trigger"]')

    // Ensure starting state is None
    if (!(await permSelect.textContent())?.match(/none/i)) {
      await permSelect.click()
      await page
        .getByRole('option', { name: /^none$/i })
        .first()
        .click()
      await expect(permSelect).toContainText(/none/i, { timeout: 5000 })
    }

    await permSelect.click()
    await page
      .getByRole('option', { name: /^view$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
  })

  test('change all-players permission to Edit', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)
    await openShareMenu(page)

    const row = allPlayersRow(page)
    const permSelect = row.locator('[data-slot="select-trigger"]')

    // Ensure starting state is View
    if (!(await permSelect.textContent())?.match(/view/i)) {
      await permSelect.click()
      await page
        .getByRole('option', { name: /^view$/i })
        .first()
        .click()
      await expect(permSelect).toContainText(/view/i, { timeout: 5000 })
    }

    await permSelect.click()
    await page
      .getByRole('option', { name: /^edit$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/edit/i, { timeout: 5000 })
  })

  test('change permission back to None', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)
    await openShareMenu(page)

    const row = allPlayersRow(page)
    const permSelect = row.locator('[data-slot="select-trigger"]')

    // Ensure starting state is Edit
    if (!(await permSelect.textContent())?.match(/edit/i)) {
      await permSelect.click()
      await page
        .getByRole('option', { name: /^edit$/i })
        .first()
        .click()
      await expect(permSelect).toContainText(/edit/i, { timeout: 5000 })
    }

    await permSelect.click()
    await page
      .getByRole('option', { name: /^none$/i })
      .first()
      .click()

    await expect(permSelect).toContainText(/none/i, { timeout: 5000 })
  })

  test('folder share menu shows permission controls', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await openItem(page, folderName)
    await openShareMenu(page)

    await expect(page.getByText(`Share "${folderName}"`)).toBeVisible()
    await expect(allPlayersRow(page).locator('[data-slot="select-trigger"]')).toBeVisible()
  })
})
