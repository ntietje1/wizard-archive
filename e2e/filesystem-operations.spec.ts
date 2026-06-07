import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import {
  createFolder,
  createNote,
  dragSidebarItemToSidebarItem,
  expectFolderItemHidden,
  expectFolderItemVisible,
  expectSelected,
  expectSidebarItemHidden,
  expectSidebarItemVisible,
  expectTrashItemHidden,
  expectTrashItemVisible,
  focusFolderContents,
  openContextMenu,
  openItem,
  openTrashPopover,
  permanentlyDeleteTrashItem,
  renameOpenedItem,
  restoreTrashItem,
  selectSidebarItems,
  waitForFilesystemIdle,
} from './helpers/sidebar-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  pressCopy,
  pressCut,
  pressPaste,
  pressRedo,
  pressSelectAll,
  pressUndo,
} from './helpers/keyboard-helpers'

const campaignName = testName('E2E Filesystem')
const conflictDialogName = 'Resolve File Conflict'
let uniqueCounter = 0

function uniqueName(prefix: string) {
  uniqueCounter += 1
  return `${prefix} ${Date.now()}-${uniqueCounter}`
}

async function focusNonEditableTarget(page: Page) {
  const sidebarSurface = page
    .getByRole('navigation', { name: 'Sidebar' })
    .locator('[data-item-surface-hotkey-target="true"]')
    .first()
  await sidebarSurface.focus()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest('[data-item-surface-hotkey-target="true"]')),
      ),
    )
    .toBe(true)
}

async function expectNoConflictDialog(page: Page) {
  await expect(page.getByRole('dialog', { name: conflictDialogName })).toHaveCount(0)
}

async function copySidebarItemsIntoFolder(
  page: Page,
  itemNames: Array<string>,
  folderName: string,
  options: { expectCompleted?: boolean } = {},
) {
  await openItem(page, folderName)
  await page.keyboard.press('Escape')
  await selectSidebarItems(page, itemNames)
  await pressCopy(page)
  await openContextMenu(page, folderName)
  await page.getByRole('menuitem', { name: 'Paste' }).click()
  if (options.expectCompleted !== false) {
    await openItem(page, folderName)
    await expectFolderItemVisible(page, folderName, itemNames[0])
  }
}

async function createUntitledNote(page: Page) {
  const previousUrl = page.url()
  await page.getByRole('button', { name: 'Create new note' }).click()
  const noteCard = page.getByRole('button', { name: /^Note \d+/ }).last()
  await expect
    .poll(async () => page.url() !== previousUrl || (await noteCard.isVisible()))
    .toBe(true)
  if (page.url() === previousUrl) {
    await noteCard.click()
    await expect(page).not.toHaveURL(previousUrl, { timeout: 10000 })
  }
  await waitForFilesystemIdle(page)
}

test.describe.serial('filesystem command operations', () => {
  test.setTimeout(120000)

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

  test.beforeEach(async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)
    await waitForFilesystemIdle(page)
  })

  test('create undo and redo restore the visible item', async ({ page }) => {
    await createUntitledNote(page)
    const nameInput = page.getByRole('textbox', { name: 'Item name' })
    await expect(nameInput).toHaveValue(/untitled/i, { timeout: 10000 })
    const defaultNoteName = await nameInput.inputValue()
    await expectSidebarItemVisible(page, defaultNoteName)

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemHidden(page, defaultNoteName)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, defaultNoteName)
  })

  test('multiple undone operations can be redone in order', async ({ page }) => {
    await createUntitledNote(page)
    const nameInput = page.getByRole('textbox', { name: 'Item name' })
    const firstCreatedName = await nameInput.inputValue()
    await createUntitledNote(page)
    const secondCreatedName = await nameInput.inputValue()

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemHidden(page, secondCreatedName)
    await expectSidebarItemVisible(page, firstCreatedName)
    await waitForFilesystemIdle(page)

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemHidden(page, firstCreatedName)
    await waitForFilesystemIdle(page)

    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, firstCreatedName)
    await expectSidebarItemHidden(page, secondCreatedName)
    await waitForFilesystemIdle(page)

    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, secondCreatedName)
  })

  test('rename undo restores the previous sidebar name', async ({ page }) => {
    const originalName = uniqueName('Lifecycle Note')
    const renamedName = uniqueName('Renamed Lifecycle Note')

    await createNote(page, originalName)
    await renameOpenedItem(page, renamedName)
    await expectSidebarItemVisible(page, renamedName)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemVisible(page, originalName)
    await expectSidebarItemHidden(page, renamedName)
  })

  test('mixed operation undo and redo replay in stack order', async ({ page }) => {
    const originalName = uniqueName('Mixed Stack Note')
    const renamedName = uniqueName('Mixed Stack Renamed')

    await createNote(page, originalName)
    await renameOpenedItem(page, renamedName)
    await expectSidebarItemVisible(page, renamedName)
    await waitForFilesystemIdle(page)

    await selectSidebarItems(page, [renamedName])
    await page.keyboard.press('Delete')
    await expectSidebarItemHidden(page, renamedName)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, renamedName)
    await waitForFilesystemIdle(page)
    await page.keyboard.press('Escape')

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemVisible(page, renamedName)
    await openTrashPopover(page)
    await expectTrashItemHidden(page, renamedName)
    await waitForFilesystemIdle(page)
    await page.keyboard.press('Escape')

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemVisible(page, originalName)
    await expectSidebarItemHidden(page, renamedName)
    await waitForFilesystemIdle(page)

    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, renamedName)
    await expectSidebarItemHidden(page, originalName)
    await waitForFilesystemIdle(page)

    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemHidden(page, renamedName)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, renamedName)
  })

  test('copy, duplicate, undo, and redo use same-parent keep-both behavior', async ({ page }) => {
    const sourceName = uniqueName('Copy Source')
    const copiedName = `${sourceName} 1`
    const duplicatedName = `${sourceName} 2`

    await createNote(page, sourceName)
    await selectSidebarItems(page, [sourceName])
    await pressCopy(page)
    await pressPaste(page)
    await expectNoConflictDialog(page)
    await expectSidebarItemVisible(page, copiedName)

    await pressUndo(page)
    await expectSidebarItemHidden(page, copiedName)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, copiedName)

    await openContextMenu(page, sourceName)
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expectNoConflictDialog(page)
    await expectSidebarItemVisible(page, duplicatedName)
    await expectSelected(page, duplicatedName)

    await page.keyboard.press('Delete')
    await expectSidebarItemHidden(page, duplicatedName)
    await expectSidebarItemVisible(page, sourceName)
    await expectSidebarItemVisible(page, copiedName)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, duplicatedName)
  })

  test('paste targets match native filesystem expectations', async ({ page }) => {
    const targetFolder = uniqueName('Paste Target Folder')
    const contextSource = uniqueName('Context Paste Source')
    const folderSourceA = uniqueName('Folder Paste Source A')
    const folderSourceB = uniqueName('Folder Paste Source B')
    const cutSource = uniqueName('Cut Source')
    const moveSource = uniqueName('Move Source')

    await createFolder(page, targetFolder)
    await createNote(page, contextSource)
    await createNote(page, folderSourceA)
    await createNote(page, folderSourceB)
    await createNote(page, cutSource)
    await createNote(page, moveSource)

    await selectSidebarItems(page, [contextSource])
    await pressCopy(page)
    await openContextMenu(page, targetFolder)
    await page.getByRole('menuitem', { name: 'Paste' }).click()
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, contextSource)

    await copySidebarItemsIntoFolder(page, [folderSourceA, folderSourceB], targetFolder)
    await expectFolderItemVisible(page, targetFolder, folderSourceA)
    await expectFolderItemVisible(page, targetFolder, folderSourceB)
    await page.keyboard.press('Escape')
    await focusFolderContents(page, targetFolder)
    await pressSelectAll(page)
    await pressCopy(page)
    await pressPaste(page)
    await expectFolderItemVisible(page, targetFolder, `${folderSourceA} 1`)
    await expectFolderItemVisible(page, targetFolder, `${folderSourceB} 1`)
    await expectNoConflictDialog(page)

    await selectSidebarItems(page, [cutSource])
    await pressCut(page)
    await page.keyboard.press('Escape')
    await openItem(page, targetFolder)
    await focusFolderContents(page, targetFolder)
    await pressPaste(page)
    await expectFolderItemHidden(page, targetFolder, cutSource)
    await expectSidebarItemVisible(page, cutSource)

    await selectSidebarItems(page, [cutSource])
    await pressCut(page)
    await pressPaste(page)
    await expectNoConflictDialog(page)
    await openItem(page, targetFolder)
    await focusFolderContents(page, targetFolder)
    await pressPaste(page)
    await expectFolderItemHidden(page, targetFolder, cutSource)
    await expectSidebarItemVisible(page, cutSource)

    await selectSidebarItems(page, [moveSource])
    await pressCut(page)
    await openItem(page, targetFolder)
    await focusFolderContents(page, targetFolder)
    await pressPaste(page)
    await expectSidebarItemHidden(page, moveSource)
    await expectFolderItemVisible(page, targetFolder, moveSource)

    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemVisible(page, moveSource)
    await expectFolderItemHidden(page, targetFolder, moveSource)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemHidden(page, moveSource)
    await expectFolderItemVisible(page, targetFolder, moveSource)
    await waitForFilesystemIdle(page)
    await focusFolderContents(page, targetFolder)
    await page.keyboard.press('Delete')
    await expectFolderItemHidden(page, targetFolder, moveSource)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, moveSource)
  })

  test('trash, restore, and hard delete have deterministic undo behavior', async ({ page }) => {
    const trashNote = uniqueName('Trash Undo Note')
    const restoreNote = uniqueName('Restore Undo Note')
    const hardDeleteNote = uniqueName('Hard Delete Note')

    await createNote(page, trashNote)
    await selectSidebarItems(page, [trashNote])
    await page.keyboard.press('Delete')
    await expectSidebarItemHidden(page, trashNote)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, trashNote)

    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemVisible(page, trashNote)
    await expectTrashItemHidden(page, trashNote)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemHidden(page, trashNote)
    await expectTrashItemVisible(page, trashNote)
    await page.keyboard.press('Escape')

    await createNote(page, restoreNote)
    await selectSidebarItems(page, [restoreNote])
    await page.keyboard.press('Delete')
    await openTrashPopover(page)
    await restoreTrashItem(page, restoreNote)
    await expectSidebarItemVisible(page, restoreNote)
    await expectTrashItemHidden(page, restoreNote)

    await page.keyboard.press('Escape')
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemHidden(page, restoreNote)
    await openTrashPopover(page)
    await expectTrashItemVisible(page, restoreNote)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await expectSidebarItemVisible(page, restoreNote)
    await expectTrashItemHidden(page, restoreNote)
    await page.keyboard.press('Escape')

    await createNote(page, hardDeleteNote)
    await selectSidebarItems(page, [hardDeleteNote])
    await page.keyboard.press('Delete')
    await openTrashPopover(page)
    await permanentlyDeleteTrashItem(page, hardDeleteNote)
    await expectTrashItemHidden(page, hardDeleteNote)

    await focusNonEditableTarget(page)
    await pressUndo(page)
    await expectSidebarItemHidden(page, hardDeleteNote)
    await openTrashPopover(page)
    await expectTrashItemHidden(page, hardDeleteNote)
  })

  test('conflict decisions apply visible filesystem outcomes', async ({ page }) => {
    const targetFolder = uniqueName('Conflict Target')
    const keepA = uniqueName('Keep Conflict A')
    const keepB = uniqueName('Keep Conflict B')
    const perItemA = uniqueName('Per Item Conflict A')
    const perItemB = uniqueName('Per Item Conflict B')

    await createFolder(page, targetFolder)
    await createNote(page, keepA)
    await createNote(page, keepB)
    await copySidebarItemsIntoFolder(page, [keepA, keepB], targetFolder)
    await expectFolderItemVisible(page, targetFolder, keepA)
    await expectFolderItemVisible(page, targetFolder, keepB)

    await copySidebarItemsIntoFolder(page, [keepA, keepB], targetFolder, { expectCompleted: false })
    await expect(page.getByRole('dialog', { name: conflictDialogName })).toBeVisible()
    await page.getByRole('button', { name: 'Keep both items' }).click()
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, `${keepA} 1`)
    await expectFolderItemVisible(page, targetFolder, `${keepB} 1`)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressUndo(page)
    await openItem(page, targetFolder)
    await expectFolderItemHidden(page, targetFolder, `${keepA} 1`)
    await expectFolderItemHidden(page, targetFolder, `${keepB} 1`)
    await waitForFilesystemIdle(page)
    await focusNonEditableTarget(page)
    await pressRedo(page)
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, `${keepA} 1`)
    await expectFolderItemVisible(page, targetFolder, `${keepB} 1`)

    await copySidebarItemsIntoFolder(page, [keepA, keepB], targetFolder, { expectCompleted: false })
    await expect(page.getByRole('dialog', { name: conflictDialogName })).toBeVisible()
    await page.getByRole('button', { name: 'Skip these items' }).click()
    await openItem(page, targetFolder)
    await expectFolderItemHidden(page, targetFolder, `${keepA} 2`)
    await expectFolderItemHidden(page, targetFolder, `${keepB} 2`)

    await createNote(page, perItemA)
    await createNote(page, perItemB)
    await copySidebarItemsIntoFolder(page, [perItemA, perItemB], targetFolder)
    await copySidebarItemsIntoFolder(page, [perItemA, perItemB], targetFolder, {
      expectCompleted: false,
    })
    await expect(page.getByRole('dialog', { name: conflictDialogName })).toBeVisible()
    await page.getByRole('button', { name: 'Decide for each item' }).click()
    const applyChoicesButton = page.getByRole('button', {
      name: /apply selected conflict choices/i,
    })
    await expect(applyChoicesButton).toBeDisabled()
    await page.getByRole('button', { name: `Use incoming ${perItemA}` }).click()
    await page.getByRole('button', { name: `Use existing ${perItemA}` }).click()
    await page.getByRole('button', { name: `Use existing ${perItemB}` }).click()
    await applyChoicesButton.click()
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, `${perItemA} 1`)
    await expectFolderItemHidden(page, targetFolder, `${perItemB} 1`)
  })

  test('multi-select drag keeps moved items selected after backend settlement', async ({
    page,
  }) => {
    const targetFolder = uniqueName('Drag Target')
    const dragA = uniqueName('Drag Selected A')
    const dragB = uniqueName('Drag Selected B')

    await createFolder(page, targetFolder)
    await createNote(page, dragA)
    await createNote(page, dragB)

    await page.keyboard.press('Escape')
    await selectSidebarItems(page, [dragA, dragB])
    await dragSidebarItemToSidebarItem(page, dragA, targetFolder)

    await expectSelected(page, dragA)
    await expectSelected(page, dragB)
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, dragA)
    await expectFolderItemVisible(page, targetFolder, dragB)
  })

  test('ctrl-drag copies selected items into a folder', async ({ page }) => {
    const targetFolder = uniqueName('Ctrl Drag Target')
    const dragCopyA = uniqueName('Ctrl Drag Copy A')
    const dragCopyB = uniqueName('Ctrl Drag Copy B')

    await createFolder(page, targetFolder)
    await createNote(page, dragCopyA)
    await createNote(page, dragCopyB)

    await page.keyboard.press('Escape')
    await selectSidebarItems(page, [dragCopyA, dragCopyB])
    await dragSidebarItemToSidebarItem(page, dragCopyA, targetFolder, {
      modifier: 'ControlOrMeta',
    })

    await expectSidebarItemVisible(page, dragCopyA)
    await expectSidebarItemVisible(page, dragCopyB)
    await openItem(page, targetFolder)
    await expectFolderItemVisible(page, targetFolder, dragCopyA)
    await expectFolderItemVisible(page, targetFolder, dragCopyB)
  })
})
