import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createCampaign, deleteCampaign, navigateToCampaign } from './helpers/campaign-helpers'
import { typeInEditor } from './helpers/editor-helpers'
import { AUTH_STORAGE_PATH, testName } from './helpers/constants'
import {
  closeSearchWithKeyboard,
  expectResultWithText,
  getResultItems,
  getSearchDialog,
  getSearchInput,
  getSelectedResult,
  getStatusText,
  openSearchDialog,
  openSearchWithKeyboard,
  typeSearch,
  waitForResults,
} from './helpers/search-helpers'

const campaignName = testName('E2E Search')
const noteDragonLore = `Dragon Lore ${Date.now()}`
const noteDragonSlayer = `Dragon Slayer Guide ${Date.now()}`
const folderTreasure = `Treasure Maps ${Date.now()}`
const noteHiddenGems = `Hidden Gems ${Date.now()}`

async function createItemViaUI(
  page: Page,
  type: 'Note' | 'Folder' | 'Map' | 'File' | 'Canvas',
  name: string,
) {
  await page.getByRole('link', { name: 'New' }).click()
  await page.getByRole('button', { name: new RegExp(`^${type} `) }).click()
  await expect(page).toHaveURL(/\?item=/, { timeout: 10000 })

  const nameInput = page.getByRole('textbox', { name: 'Item name' })
  await expect(nameInput).toBeVisible({ timeout: 10000 })
  await nameInput.click()
  await nameInput.fill(name)
  await nameInput.press('Enter')
  await expect(nameInput).toHaveAttribute('readonly', '', { timeout: 5000 })

  await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 10000 })
}

test.describe.serial('search', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()

    await page.goto('/campaigns')
    await createCampaign(page, campaignName)
    await navigateToCampaign(page, campaignName)

    await createItemViaUI(page, 'Note', noteHiddenGems)
    await typeInEditor(page, 'A dragon hoard lies beneath the mountain')

    await createItemViaUI(page, 'Note', noteDragonLore)
    await typeInEditor(page, 'The ancient dragons ruled the northern peaks')

    await createItemViaUI(page, 'Note', noteDragonSlayer)
    await typeInEditor(page, 'Strategies for defeating fire-breathing beasts')

    await createItemViaUI(page, 'Folder', folderTreasure)

    // Wait for note content to persist and be indexed
    const indexWaitMs = Number(process.env.TEST_INDEX_WAIT_MS ?? 5000)
    await page.waitForTimeout(indexWaitMs)

    await page.close()
    await context.close()
  })

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH })
    const page = await context.newPage()
    await page.goto('/campaigns')
    try {
      await deleteCampaign(page, campaignName)
    } catch (e) {
      console.warn(`Cleanup failed for "${campaignName}":`, e)
    }
    await page.close()
    await context.close()
  })

  // --- Dialog Open/Close ---

  test('opens search dialog via button click', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const input = getSearchInput(page)
    await expect(input).toBeFocused()
  })

  test('closes search dialog via close button', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const dialog = getSearchDialog(page)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
  })

  test('opens search dialog via Ctrl+K', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchWithKeyboard(page)
    await expect(getSearchInput(page)).toBeFocused()
  })

  test('closes search dialog via Escape', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchWithKeyboard(page)
    await closeSearchWithKeyboard(page)
  })

  test('toggles search dialog with Ctrl+K', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchWithKeyboard(page)
    await page.keyboard.press('Control+k')
    await expect(getSearchDialog(page)).not.toBeVisible({ timeout: 5000 })
  })

  // --- Empty State ---

  test('shows empty state message when no query and no recents', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // Clear any existing recent items from localStorage
    await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith('recent-items-')) localStorage.removeItem(key)
      }
    })

    await openSearchDialog(page)
    await expect(getSearchDialog(page).getByText('Type to search your vault')).toBeVisible()
  })

  // --- Title Search ---

  test('finds items by exact title match', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, noteDragonLore)
    await waitForResults(page)

    const selected = getSelectedResult(page)
    await expect(selected).toContainText(noteDragonLore, { timeout: 5000 })
  })

  test('finds multiple items by partial title match', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Dragon')
    await waitForResults(page)

    await expectResultWithText(page, noteDragonLore)
    await expectResultWithText(page, noteDragonSlayer)
  })

  test('title search is case insensitive', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'DRAGON')
    await waitForResults(page)

    await expectResultWithText(page, noteDragonLore)
    await expectResultWithText(page, noteDragonSlayer)
  })

  test('finds folders by title', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Treasure')
    await waitForResults(page)

    await expectResultWithText(page, folderTreasure)
  })

  test('shows no results for non-matching query', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'xyznonexistent99')
    await waitForResults(page)

    await expect(getSearchDialog(page).getByText('No results found')).toBeVisible({ timeout: 5000 })
  })

  test('displays result count in status', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, folderTreasure)
    await waitForResults(page)

    await expect(getStatusText(page)).toContainText('result', { timeout: 5000 })
  })

  // --- Body/Content Search ---

  test('finds notes by body content', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'ancient')
    await waitForResults(page)

    await expectResultWithText(page, noteDragonLore)
  })

  test('body match shows highlighted text snippet', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'ancient')
    await waitForResults(page)

    const result = await expectResultWithText(page, noteDragonLore)
    const mark = result.locator('mark')
    await expect(mark.first()).toBeVisible({ timeout: 5000 })
  })

  test('deduplicates title and body matches', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'dragon')

    // Wait for body results to arrive from Convex — "Hidden Gems" contains "dragon" in body
    const hiddenGemsResult = getResultItems(page).filter({ hasText: noteHiddenGems })
    await expect(hiddenGemsResult.first()).toBeVisible({ timeout: 15000 })

    // "Dragon Lore" and "Dragon Slayer Guide" match by title
    await expectResultWithText(page, noteDragonLore)
    await expectResultWithText(page, noteDragonSlayer)

    // Dragon Lore should NOT appear twice (once for title, once for body)
    const dragonLoreResults = getResultItems(page).filter({ hasText: noteDragonLore })
    await expect(dragonLoreResults).toHaveCount(1)
  })

  test('title matches appear before body matches', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'dragon')

    // Wait for body results to arrive
    const hiddenGemsResult = getResultItems(page).filter({ hasText: noteHiddenGems })
    await expect(hiddenGemsResult.first()).toBeVisible({ timeout: 15000 })

    const allOptions = getResultItems(page)
    const count = await allOptions.count()

    // Find indices of title matches and body match
    let hiddenGemsIndex = -1
    let dragonLoreIndex = -1
    for (let i = 0; i < count; i++) {
      const text = await allOptions.nth(i).textContent()
      if (text?.includes(noteHiddenGems)) hiddenGemsIndex = i
      if (text?.includes(noteDragonLore)) dragonLoreIndex = i
    }

    // Title match (Dragon Lore) should be before body match (Hidden Gems)
    expect(dragonLoreIndex).toBeLessThan(hiddenGemsIndex)
  })

  // --- Keyboard Navigation ---

  test('arrow keys navigate through results', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Dragon')
    await waitForResults(page)

    // First item should be selected by default
    const firstSelected = getSelectedResult(page)
    const firstText = await firstSelected.textContent()

    // Arrow down should move to second item
    await page.keyboard.press('ArrowDown')
    const secondSelected = getSelectedResult(page)
    const secondText = await secondSelected.textContent()
    expect(firstText).not.toEqual(secondText)

    // Arrow up should return to first item
    await page.keyboard.press('ArrowUp')
    const backToFirst = getSelectedResult(page)
    await expect(backToFirst).toHaveText(firstText!)
  })

  test('arrow keys clamp at boundaries', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Dragon')

    // Wait for body results to arrive so the result list is stable
    const hiddenGemsResult = getResultItems(page).filter({ hasText: noteHiddenGems })
    await expect(hiddenGemsResult.first()).toBeVisible({ timeout: 15000 })

    // At first item, ArrowUp should stay at first
    const firstSelected = await getSelectedResult(page).textContent()
    await page.keyboard.press('ArrowUp')
    await expect(getSelectedResult(page)).toHaveText(firstSelected!)

    // Navigate to last item and try ArrowDown
    const count = await getResultItems(page).count()
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('ArrowDown')
    }
    const lastSelected = await getSelectedResult(page).textContent()
    await page.keyboard.press('ArrowDown')
    await expect(getSelectedResult(page)).toHaveText(lastSelected!)
  })

  test('Enter key navigates to selected result', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, noteDragonLore)
    await waitForResults(page)

    await expectResultWithText(page, noteDragonLore)
    await page.keyboard.press('Enter')

    await expect(getSearchDialog(page)).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(noteDragonLore, {
      timeout: 10000,
    })
  })

  // --- Mouse Interaction ---

  test('hover changes selection', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Dragon')

    // Wait for body results to arrive so the result list is stable
    const hiddenGemsResult = getResultItems(page).filter({ hasText: noteHiddenGems })
    await expect(hiddenGemsResult.first()).toBeVisible({ timeout: 15000 })

    const items = getResultItems(page)
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Hover over second item
    await items.nth(1).hover()
    await expect(items.nth(1)).toHaveAttribute('aria-selected', 'true')
  })

  test('click navigates to result and closes dialog', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, folderTreasure)
    await waitForResults(page)

    const result = await expectResultWithText(page, folderTreasure)
    await result.click()

    await expect(getSearchDialog(page)).not.toBeVisible({ timeout: 5000 })
  })

  // --- Preview Panel ---

  test('toggles preview panel', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const dialog = getSearchDialog(page)

    // Ensure preview is visible initially (default showPreview=true)
    const toggleBtn = dialog.getByRole('button', { name: 'Toggle preview' })

    // Toggle off
    await toggleBtn.click()
    await expect(dialog.getByRole('button', { name: 'Open result' })).not.toBeVisible()

    // Toggle back on
    await toggleBtn.click()
    // Preview pane should now be visible (but may show empty state)
  })

  test('preview shows selected note content', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const dialog = getSearchDialog(page)

    const toggleBtn = dialog.getByRole('button', { name: 'Toggle preview' })
    const previewOn = await dialog
      .getByRole('button', { name: 'Open result' })
      .isVisible()
      .catch(() => false)
    if (!previewOn) {
      await toggleBtn.click()
    }

    await typeSearch(page, noteDragonLore)
    await waitForResults(page)

    // The preview should show the note name in its header
    await expect(dialog.getByText(noteDragonLore)).toBeVisible({ timeout: 10000 })
  })

  test('open result button navigates from preview', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const dialog = getSearchDialog(page)

    await typeSearch(page, noteDragonLore)
    await waitForResults(page)

    const openBtn = dialog.getByRole('button', { name: 'Open result' })
    await expect(openBtn).toBeVisible({ timeout: 5000 })
    await openBtn.click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(noteDragonLore, {
      timeout: 10000,
    })
  })

  // --- Recent Items ---

  test('recently opened items appear in search empty state', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // Navigate to an item via sidebar to register it as recent
    await page.getByRole('link', { name: noteDragonSlayer, exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(noteDragonSlayer, {
      timeout: 10000,
    })

    await openSearchDialog(page)
    await expect(getStatusText(page)).toHaveText('Recent', { timeout: 5000 })
    await expectResultWithText(page, noteDragonSlayer)
  })

  test('most recently opened item appears first in recents', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    // Open Dragon Lore first, then Dragon Slayer
    await page.getByRole('link', { name: noteDragonLore, exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(noteDragonLore, {
      timeout: 10000,
    })

    await page.getByRole('link', { name: noteDragonSlayer, exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Item name' })).toHaveValue(noteDragonSlayer, {
      timeout: 10000,
    })

    await openSearchDialog(page)

    const items = getResultItems(page)
    const firstItem = items.first()
    await expect(firstItem).toContainText(noteDragonSlayer, { timeout: 5000 })
  })

  // --- Query Lifecycle ---

  test('query is cleared when dialog is closed and reopened', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, 'Dragon')
    await closeSearchWithKeyboard(page)

    await openSearchDialog(page)
    await expect(getSearchInput(page)).toHaveValue('')
  })

  // --- Edge Cases ---

  test('special characters do not crash search', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, '[brackets](parens){braces}')
    await waitForResults(page)

    await expect(getSearchDialog(page).getByText('No results found')).toBeVisible({ timeout: 5000 })
  })

  test('whitespace-only query is treated as empty', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    await typeSearch(page, '   ')
    await waitForResults(page)

    // Should not show "No results found" — should show recents or empty state
    await expect(getSearchDialog(page).getByText('No results found')).not.toBeVisible()
  })

  test('very long query does not crash', async ({ page }) => {
    await page.goto('/campaigns')
    await navigateToCampaign(page, campaignName)

    await openSearchDialog(page)
    const longQuery = 'a'.repeat(250)
    await typeSearch(page, longQuery)
    await waitForResults(page)

    await expect(getSearchDialog(page).getByText('No results found')).toBeVisible({
      timeout: 10000,
    })
  })
})
