import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  createFolder,
  createNote,
  dragSidebarItemToSidebarItem,
  openItem,
  selectSidebarItems,
  sidebarItem,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'

const campaignName = testName('MS')
const noteA = `Multi Note A ${Date.now()}`
const noteB = `Multi Note B ${Date.now()}`
const noteC = `Multi Note C ${Date.now()}`
const folderName = `Multi Folder ${Date.now()}`
const dragNoteA = `Drag Note A ${Date.now()}`
const dragNoteB = `Drag Note B ${Date.now()}`
const selectedMoveNoteA = `Selected Move Note A ${Date.now()}`
const selectedMoveNoteB = `Selected Move Note B ${Date.now()}`
const VISIBILITY_TIMEOUT = 15000

async function sidebarSelectionRow(
  sidebar: Locator,
  itemName: string,
  timeout = VISIBILITY_TIMEOUT,
) {
  const row = sidebar.getByRole('button', { name: itemName, exact: true }).locator('..')
  await expect(row).toHaveCount(1, { timeout })
  return row
}

test.describe.serial('sidebar and folder multi-select item operations', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)
    await createFolder(page, folderName)
    await createNote(page, noteA)
    await createNote(page, noteB)
    await createNote(page, noteC)
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

  test('duplicates a multi-selection from the context menu using same-parent keep-both names', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await selectSidebarItems(page, [noteA, noteB])
    await sidebarItem(page, noteB).click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: 'Copy' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveCount(0)

    await page.getByRole('menuitem', { name: 'Duplicate' }).click()

    await expect(sidebar.getByRole('button', { name: `${noteA} 1`, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
    await expect(sidebar.getByRole('button', { name: `${noteB} 1`, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
    await expect(sidebar.getByRole('button', { name: noteA, exact: true })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: noteB, exact: true })).toBeVisible()
  })

  test('copies a multi-selection with hotkeys and pastes duplicates into folder view', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    const copyNote = `Hotkey Copy Note ${Date.now()}`
    await createNote(page, copyNote)

    await selectSidebarItems(page, [noteA, copyNote])
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C')

    await openItem(page, folderName)
    const folderContents = page.getByRole('region', { name: `${folderName} folder contents` })
    await folderContents.focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')

    await expect(folderContents.getByRole('button', { name: noteA, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
    await expect(folderContents.getByRole('button', { name: copyNote, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
  })

  test('drags a selected group into a sidebar folder', async ({ page }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await createNote(page, dragNoteA)
    await createNote(page, dragNoteB)
    await page.keyboard.press('Escape')
    await selectSidebarItems(page, [dragNoteA, dragNoteB])
    await dragSidebarItemToSidebarItem(page, dragNoteA, folderName)

    await openItem(page, folderName)
    const folderContents = page.getByRole('region', { name: `${folderName} folder contents` })
    await expect(folderContents.getByRole('button', { name: dragNoteA, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
    await expect(folderContents.getByRole('button', { name: dragNoteB, exact: true })).toBeVisible({
      timeout: VISIBILITY_TIMEOUT,
    })
  })

  test('keeps moved sidebar items selected after confirmed move result settles', async ({
    page,
  }) => {
    await page.goto('/campaigns', { waitUntil: 'commit' })
    await navigateToCampaign(page, campaignName)
    await createNote(page, selectedMoveNoteA)
    await createNote(page, selectedMoveNoteB)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    await page.keyboard.press('Escape')
    await selectSidebarItems(page, [selectedMoveNoteA, selectedMoveNoteB])
    await dragSidebarItemToSidebarItem(page, selectedMoveNoteA, folderName)

    await expect(await sidebarSelectionRow(sidebar, selectedMoveNoteA)).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: VISIBILITY_TIMEOUT },
    )
    await expect(await sidebarSelectionRow(sidebar, selectedMoveNoteB)).toHaveAttribute(
      'data-selected',
      'true',
      { timeout: VISIBILITY_TIMEOUT },
    )
  })
})
