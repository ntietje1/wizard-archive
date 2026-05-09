import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { createFolder, createNote, openItem } from './helpers/sidebar-helpers'
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

function sidebarSelectionRow(sidebar: Locator, itemName: string) {
  return (
    sidebar
      .getByRole('link', { name: itemName, exact: true })
      // This XPath reaches the selectable row wrapper; revisit if the sidebar DOM is flattened.
      .locator('xpath=ancestor::*[@aria-selected][1]')
  )
}

test.describe.serial('sidebar and folder multi-select item operations', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STORAGE_PATH,
    })
    const page = await context.newPage()
    await page.goto('/campaigns')
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
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch {
      /* best-effort */
    }
    await page.close()
    await context.close()
  })

  test('duplicates a multi-selection from the context menu using keep both for conflicts', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const first = sidebar.getByRole('link', { name: noteA, exact: true })
    const second = sidebar.getByRole('link', { name: noteB, exact: true })

    await first.click()
    await second.click({ modifiers: ['ControlOrMeta'] })
    await second.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toHaveCount(0)

    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(page.getByRole('dialog', { name: 'Replace or Skip Files' })).toBeVisible()
    await page.getByRole('checkbox', { name: 'Apply to all remaining conflicts' }).click()
    await page.getByRole('button', { name: 'Keep Both' }).click()

    await expect(sidebar.getByRole('link', { name: `${noteA} 2`, exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(sidebar.getByRole('link', { name: `${noteB} 2`, exact: true })).toBeVisible()
  })

  test('copies a multi-selection with hotkeys and pastes duplicates into folder view', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })

    await sidebar.getByRole('link', { name: noteA, exact: true }).click()
    await sidebar
      .getByRole('link', { name: noteC, exact: true })
      .click({ modifiers: ['ControlOrMeta'] })
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C')

    await openItem(page, folderName)
    const folderContents = page.getByRole('group', { name: `${folderName} folder contents` })
    await folderContents.focus()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')

    await expect(folderContents.getByRole('link', { name: noteA, exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(folderContents.getByRole('link', { name: noteC, exact: true })).toBeVisible()
  })

  test('drags a selected group into a sidebar folder', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createNote(page, dragNoteA)
    await createNote(page, dragNoteB)
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const first = sidebar.getByRole('link', { name: dragNoteA, exact: true })
    const second = sidebar.getByRole('link', { name: dragNoteB, exact: true })
    const folder = sidebar.getByRole('link', { name: folderName, exact: true })

    await first.click()
    await second.click({ modifiers: ['ControlOrMeta'] })
    await first.dragTo(folder)

    await openItem(page, folderName)
    const folderContents = page.getByRole('group', { name: `${folderName} folder contents` })
    await expect(folderContents.getByRole('link', { name: dragNoteA, exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(folderContents.getByRole('link', { name: dragNoteB, exact: true })).toBeVisible()
  })

  test('keeps moved sidebar items selected after confirmed move result settles', async ({
    page,
  }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await createNote(page, selectedMoveNoteA)
    await createNote(page, selectedMoveNoteB)

    const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
    const first = sidebar.getByRole('link', { name: selectedMoveNoteA, exact: true })
    const second = sidebar.getByRole('link', { name: selectedMoveNoteB, exact: true })
    const folder = sidebar.getByRole('link', { name: folderName, exact: true })

    await first.click()
    await second.click({ modifiers: ['ControlOrMeta'] })
    await first.dragTo(folder)

    await expect(sidebarSelectionRow(sidebar, selectedMoveNoteA)).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 15000 },
    )
    await expect(sidebarSelectionRow(sidebar, selectedMoveNoteB)).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
