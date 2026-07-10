import { expect, test } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  createNote,
  expectSidebarItemHidden,
  expectSidebarItemVisible,
  openContextMenu,
  openTrashPopover,
  sidebarNavigation,
  trashItem,
  waitForFilesystemIdle,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('E2E Trash')
const noteName = `TrashNote ${Date.now()}`

test.describe.serial('trash operations', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
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

  test('delete item moves it to trash', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })

    await openContextMenu(page, noteName)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()

    await expect(sidebar.getByRole('button', { name: noteName, exact: true })).not.toBeVisible({
      timeout: 10000,
    })
  })

  test('trash view shows deleted item', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await page.getByRole('button', { name: /^trash/i }).click()
    await expect(trashItem(page, noteName)).toBeVisible({ timeout: 10000 })
  })

  test('restore item from trash', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await page.getByRole('button', { name: /^trash/i }).click()

    const item = trashItem(page, noteName)
    await expect(item).toBeVisible({ timeout: 10000 })
    await item.hover()
    const restoreBtn = item.getByRole('button', { name: 'Restore', exact: true })
    await restoreBtn.click()

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await expect(sidebar.getByRole('button', { name: noteName, exact: true })).toBeVisible({
      timeout: 10000,
    })
  })

  test('drag item from mini trash popover restores it to the sidebar root', async ({ page }) => {
    const dragRestoreName = `Trash Drag Restore ${Date.now()}`
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)

    await createNote(page, dragRestoreName)
    await openContextMenu(page, dragRestoreName)
    await page.getByRole('menuitem', { name: /move to trash/i }).click()
    await expectSidebarItemHidden(page, dragRestoreName)

    await openTrashPopover(page)
    const popoverTrashItem = page
      .locator('[data-testid^="trash-item-"]')
      .filter({ hasText: dragRestoreName })
    await expect(popoverTrashItem).toBeVisible({ timeout: 10000 })

    const sidebarSurface = sidebarNavigation(page)
      .locator('[data-item-surface-hotkey-target="true"]')
      .first()
    await expect(sidebarSurface).toBeVisible({ timeout: 10000 })
    const surfaceBox = await sidebarSurface.boundingBox()
    if (!surfaceBox) throw new Error('Unable to resolve sidebar surface bounds')

    await popoverTrashItem.dragTo(sidebarSurface, {
      sourcePosition: { x: 24, y: 16 },
      targetPosition: {
        x: Math.min(80, surfaceBox.width / 2),
        y: Math.max(8, surfaceBox.height - 12),
      },
    })

    await waitForFilesystemIdle(page)
    await expectSidebarItemVisible(page, dragRestoreName)
    await openTrashPopover(page)
    await expect(popoverTrashItem).not.toBeVisible({ timeout: 10000 })
  })
})
