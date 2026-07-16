import { expect, test } from '@playwright/test'
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
    const market = sidebar.getByRole('button', { name: 'The Lantern Market' })
    const invoice = sidebar.getByRole('button', { name: 'Blue-glass Invoice' })

    await market.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Bookmark' }).click()
    await sidebar.getByRole('button', { name: 'Bookmarks' }).click()
    await expect(market).toBeVisible()
    await expect(sidebar.getByRole('button', { name: 'Blue-glass Invoice' })).toBeHidden()

    await sidebar.getByRole('button', { name: 'Bookmarks' }).click()
    await sidebar.getByRole('combobox', { name: 'Sort resources' }).selectOption({
      label: 'Title Z–A',
    })
    await expect(sidebar.locator('[data-resource-id]').first()).toContainText('The Lantern Market')

    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: 'Search' })
    await search.fill('third tide bell')
    const result = page.getByRole('option').filter({ hasText: 'The Lantern Market' })
    await expect(result).toContainText('third tide bell')
    await page.getByRole('button', { name: 'Toggle preview' }).click()
    await expect(page.getByRole('heading', { name: 'The Lantern Market' })).toBeVisible()
    await search.press('Enter')

    await expect(
      page.getByRole('textbox', { name: 'The Lantern Market note editor' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Open resource panel' }).click()
    const details = page.getByRole('complementary', { name: 'Resource panel' })
    await expect(details).toContainText('Kind')
    await expect(details).toContainText('note')
    await expect(details).toContainText('Campaign root')
    await expect(details).toContainText('01980c1a-5e70-7000-8000-000000000401')

    await details.getByRole('button', { name: 'Close sidebar' }).click()
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
    await openWorkspace(page)

    await page.getByRole('button', { name: 'Create resource' }).click()
    await page.getByRole('textbox', { name: 'New resource title' }).fill('Operations')
    await page.getByRole('menuitem', { name: 'Folder' }).click()
    await expect(page.getByText('Folder created')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Create New' })).toBeVisible()
    await expect(page.getByText('Create from Template')).toBeVisible()
    await expect(page.getByText('No templates yet')).toBeVisible()

    await page.getByRole('button', { name: 'Note', exact: true }).click()
    await expect(page.getByText('Note created')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Untitled note' })).toBeVisible()
    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Edit details' }).click()
    await page.getByRole('textbox', { name: 'Resource title' }).fill('Clue: North / South')
    await page.getByRole('textbox', { name: 'Resource icon' }).fill('Compass')
    await page.getByRole('textbox', { name: 'Resource color' }).fill('indigo')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()

    await page.getByRole('button', { name: 'Undo Edit resource' }).click()
    await expect(page.getByRole('heading', { name: 'Untitled note' })).toBeVisible()
    await page.getByRole('button', { name: 'Redo Edit resource' }).click()
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()

    await page.getByRole('button', { name: 'More options' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(page.getByRole('heading', { name: 'Clue: North / South' })).toBeVisible()
  })

  test('applies grouped trash, undo, redo, restore, and irreversible deletion truthfully', async ({
    page,
  }) => {
    const workspace = await openWorkspace(page)
    const sidebar = workspace.getByRole('navigation', { name: 'Sidebar' })
    const invoice = sidebar.getByRole('button', { name: 'Blue-glass Invoice' })
    const canvas = sidebar.getByRole('button', { name: 'Harbor Heist Board' })
    const map = sidebar.getByRole('button', { name: 'Moonwell Docks' })

    await invoice.click()
    await canvas.click({ modifiers: ['Control'] })
    await map.click({ modifiers: ['Shift'] })
    await invoice.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Copy 3 items' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Move 3 items to Trash' }).click()
    await expect(canvas).toBeHidden()
    await expect(map).toBeHidden()

    await page.getByRole('button', { name: 'Undo Trash resources' }).click()
    await expect(canvas).toBeVisible()
    await expect(map).toBeVisible()
    await page.getByRole('button', { name: 'Redo Trash resources' }).click()
    await expect(canvas).toBeHidden()
    await expect(map).toBeHidden()

    await sidebar.getByRole('button', { name: 'Trash' }).click()
    const trash = page.getByRole('region', { name: 'Trash' })
    await trash.getByRole('button', { name: 'Restore Blue-glass Invoice' }).click()
    await expect(invoice).toBeVisible()

    await trash.getByRole('button', { name: 'Empty Trash' }).click()
    await trash.getByRole('button', { name: 'Confirm empty trash' }).click()
    await expect(trash).toContainText('Trash is empty')
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })
})
