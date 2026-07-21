import { expect, test } from '@playwright/test'
import {
  createNamedResource,
  openSidebarHistoryMenu,
  renameCurrentResource,
} from './helpers/editor-resource-helpers'
import type { Page } from '@playwright/test'

async function openWorkspace(page: Page) {
  await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
  const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
  await expect(workspace).toBeVisible()
  await expect(workspace).toHaveAttribute('aria-busy', 'false')
  return workspace
}

test.describe('resource mechanics', () => {
  test('searches content, manages bookmarks, sorts, and shows authorized details', async ({
    page,
  }) => {
    const workspace = await openWorkspace(page)
    const sidebar = workspace.getByRole('navigation', { name: 'Sidebar' })
    const market = sidebar.getByRole('button', { name: 'The Lantern Market', exact: true })
    const invoice = sidebar.getByRole('button', { name: 'Blue-glass Invoice', exact: true })

    await market.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Bookmark' }).click()
    await sidebar.getByRole('button', { name: 'Show bookmarks' }).click()
    await expect(market).toBeVisible()
    await expect(
      sidebar.getByRole('button', { name: 'Blue-glass Invoice', exact: true }),
    ).toBeHidden()

    await sidebar.getByRole('button', { name: 'Exit bookmarks' }).click()
    await sidebar.getByRole('button', { name: 'Sort resources' }).click()
    await page.getByRole('menuitemradio', { name: 'File name (Z to A)' }).click()
    await expect(sidebar.locator('[data-resource-id]').first()).toContainText('The Lantern Market')

    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: 'Search' })
    await search.fill('third tide bell')
    const result = page.getByRole('option').filter({ hasText: 'The Lantern Market' })
    await expect(result).toContainText('third tide bell')
    await page.getByRole('button', { name: 'Toggle preview' }).click()
    await expect(
      page
        .getByRole('dialog', { name: 'Search' })
        .getByRole('heading', { name: 'The Lantern Market' }),
    ).toBeVisible()
    await search.press('Enter')

    await expect(
      page.getByRole('textbox', { name: 'The Lantern Market note editor' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'More options', exact: true }).click()
    const topbarMenu = page.getByRole('menu', { name: 'The Lantern Market actions' })
    await expect(topbarMenu.getByRole('menuitem', { name: 'Backlinks' })).toBeVisible()
    await expect(topbarMenu.getByRole('menuitem', { name: 'Outgoing links' })).toBeVisible()
    await expect(topbarMenu.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0)
    await expect(topbarMenu.getByRole('menuitem', { name: 'Paste' })).toHaveCount(0)
    await topbarMenu.getByRole('menuitem', { name: 'Backlinks' }).click()
    const details = page.getByRole('complementary', { name: 'Resource panel' })
    await expect(details.getByRole('button', { name: 'Backlinks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'More options', exact: true }).click()
    await page
      .getByRole('menu', { name: 'The Lantern Market actions' })
      .getByRole('menuitem', { name: 'Details' })
      .click()
    await expect(details).toContainText('Kind')
    await expect(details).toContainText('note')
    await expect(details).toContainText('Campaign root')
    await expect(details).toContainText('01980c1a-5e70-7000-8000-000000000401')

    await page.getByRole('button', { name: 'Close resource panel' }).click()
    await invoice.click()
    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await expect(details).toContainText('File metadata')
    await expect(details).toContainText('85 bytes')
    await expect(details).toContainText('text/plain')
    await expect(details).toContainText('txt')
    const downloadStarted = page.waitForEvent('download')
    await details.getByRole('button', { name: 'Download' }).click()
    const download = await downloadStarted
    expect(download.suggestedFilename()).toBe('Blue-glass Invoice.txt')
  })

  test('creates through the folder dashboard and preserves natural titles through undo and redo', async ({
    page,
  }) => {
    const workspace = await openWorkspace(page)

    await createNamedResource(page, 'Folder', 'Operations')
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Create New' })).toBeVisible()
    await expect(page.getByText('Create from Template')).toBeVisible()
    await expect(page.getByText('No templates yet')).toBeVisible()

    await page.getByRole('button', { name: 'Note', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Untitled note' })).toBeVisible()
    await renameCurrentResource(page, 'Untitled note', 'Clue: North / South')
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()

    let history = await openSidebarHistoryMenu(page)
    await expect(history.getByRole('menuitem', { name: 'New…' })).toBeVisible()
    await expect(history.getByRole('menuitem', { name: 'Paste' })).toBeDisabled()
    await history.getByRole('menuitem', { name: 'Undo rename' }).click()
    await expect(page.getByRole('heading', { name: 'Untitled note' })).toBeVisible()
    history = await openSidebarHistoryMenu(page)
    await history.getByRole('menuitem', { name: 'Redo rename' }).click()
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()

    const sidebar = workspace.getByRole('navigation', { name: 'Sidebar' })
    await sidebar.getByRole('button', { name: 'Clue: North / South', exact: true }).click({
      button: 'right',
    })
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()
  })

  test('applies grouped trash, undo, redo, restore, and irreversible deletion truthfully', async ({
    page,
  }) => {
    const workspace = await openWorkspace(page)
    const sidebar = workspace.getByRole('navigation', { name: 'Sidebar' })
    const invoice = sidebar.getByRole('button', { name: 'Blue-glass Invoice', exact: true })
    const canvas = sidebar.getByRole('button', { name: 'Harbor Heist Board', exact: true })
    const map = sidebar.getByRole('button', { name: 'Moonwell Docks', exact: true })

    await canvas.click()
    await invoice.click({ modifiers: ['Shift'] })
    await invoice.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Copy 3 items' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Move 3 items to Trash' }).click()
    await expect(canvas).toBeHidden()
    await expect(map).toBeHidden()

    let history = await openSidebarHistoryMenu(page)
    await history.getByRole('menuitem', { name: 'Undo move 3 resources to Trash' }).click()
    await expect(canvas).toBeVisible()
    await expect(map).toBeVisible()
    history = await openSidebarHistoryMenu(page)
    await history.getByRole('menuitem', { name: 'Redo move 3 resources to Trash' }).click()
    await expect(canvas).toBeHidden()
    await expect(map).toBeHidden()

    await sidebar.getByRole('button', { name: 'Trash' }).click()
    const trash = page.getByRole('region', { name: 'Trash' })
    await trash.getByRole('button', { name: 'Restore Blue-glass Invoice' }).click()
    await expect(invoice).toBeVisible()

    for (const title of ['Harbor Heist Board', 'Moonwell Docks']) {
      await trash.getByRole('button', { name: `Delete ${title} forever` }).click()
      await trash.getByRole('button', { name: `Confirm delete ${title} forever` }).click()
    }
    await expect(trash).toContainText('Trash is empty')
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  })
})
