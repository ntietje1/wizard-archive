import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote, openContextMenu, openItem } from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Keyboard')
const noteName = `KbNote ${Date.now()}`
const folderName = `KbFolder ${Date.now()}`

test.describe.serial('keyboard navigation', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createNote(page, noteName)
    await createFolder(page, folderName)
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

  test('tab through sidebar items moves focus to links', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const firstLink = sidebar.getByRole('link').first()
    await firstLink.focus()

    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    const tagName = await focused.evaluate((el) => el.tagName.toLowerCase())
    expect(['a', 'button']).toContain(tagName)
  })

  test('escape closes context menu', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await expect(page.getByRole('link', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, noteName)
    const menu = page.getByRole('menuitem').first()
    await expect(menu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).not.toBeVisible()
  })

  test('slash menu opens and navigates with arrow keys', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await openItem(page, noteName)

    const editor = page.locator('[contenteditable="true"]').first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')

    const slashMenu = page.getByRole('listbox')
    await expect(slashMenu).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('ArrowDown')
    const secondOption = slashMenu.getByRole('option').nth(1)
    await expect(secondOption).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')

    await expect(slashMenu).not.toBeVisible()
  })

  test('escape closes dialogs', async ({ page }) => {
    await page.goto('/campaigns')

    const userMenuButton = page.getByRole('button', { name: 'User menu' })
    await expect(userMenuButton).toBeVisible({ timeout: 10000 })
    await userMenuButton.click()
    await page.getByText(/settings/i).click()

    const dialog = page.getByRole('dialog', { name: /settings/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })
})
