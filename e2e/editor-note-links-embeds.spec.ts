import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

test.describe('note link and embed parity', () => {
  test('embeds a sidebar resource and preserves it across navigation', async ({ page }) => {
    const { editor, noteTitle, sidebar } = await openScratchNote(page, 'Embed scratchpad')
    const embed = await insertEmptyEmbed(page, editor)

    await sidebar.getByRole('button', { name: 'Moonwell Docks', exact: true }).dragTo(embed)
    await expect(embed.getByRole('button', { name: 'Open Moonwell Docks' })).toBeVisible()
    await expect(embed.getByText('No map image')).toBeVisible()

    await sidebar.getByRole('button', { name: 'Harbor Heist Board', exact: true }).click()
    await sidebar.getByRole('button', { name: noteTitle, exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Moonwell Docks' })).toBeVisible()

    if (process.env.WA_WIZ_266_VISUAL_QA_PATH) {
      await page.screenshot({ path: process.env.WA_WIZ_266_VISUAL_QA_PATH })
    }
  })

  test('links a safe external target and rejects a recursive resource drop', async ({ page }) => {
    const { editor, noteTitle, sidebar } = await openScratchNote(page, 'Embed targets')
    const external = await insertEmptyEmbed(page, editor)
    await external.getByRole('button', { name: 'or link to an external file' }).click()
    await external
      .getByRole('textbox', { name: 'External file URL' })
      .fill('https://example.com/lore.pdf')
    await external.getByRole('button', { name: 'Link', exact: true }).click()
    await expect(external.getByRole('link', { name: 'lore.pdf' })).toHaveAttribute(
      'href',
      'https://example.com/lore.pdf',
    )

    const recursive = await insertEmptyEmbed(page, editor)
    await sidebar.getByRole('button', { name: noteTitle, exact: true }).dragTo(recursive)
    await expect(recursive.getByText('Drag and drop a resource or file here')).toBeVisible()
  })

  test('authors and opens a canonical resource link', async ({ page }) => {
    const { editor } = await openScratchNote(page, 'Link scratchpad')
    await editor.locator('.bn-inline-content').last().click()
    await page.keyboard.type('[[')
    const moonwellOption = page.getByRole('option', { name: /Moonwell Docks/ })
    await expect(moonwellOption).toBeVisible()
    await page.keyboard.type('Moonwell', { delay: 100 })
    await moonwellOption.click()

    const link = editor.getByRole('button', { name: 'Open Moonwell Docks' })
    await expect(link).toBeVisible()
    await link.click({ modifiers: ['Control'] })
    await expect(page.getByRole('heading', { name: 'Moonwell Docks' })).toBeVisible()
  })
})

async function openScratchNote(page: Page, noteTitle: string) {
  await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
  const workspace = page.getByRole('region', { name: 'Demo workspace', exact: true })
  await expect(workspace).toHaveAttribute('aria-busy', 'false', { timeout: 45_000 })
  const sidebar = page.getByRole('navigation', { name: 'Sidebar' })
  await page.getByRole('button', { name: 'Create resource', exact: true }).click()
  await page.getByRole('textbox', { name: 'New resource title' }).fill(noteTitle)
  await page.getByRole('menuitem', { name: 'Note' }).click()
  const editor = page.getByRole('textbox', { name: `${noteTitle} note editor` })
  await expect(editor).toBeVisible()
  return { editor, noteTitle, sidebar }
}

async function insertEmptyEmbed(page: Page, editor: Locator) {
  const inline = editor.locator('.bn-inline-content').last()
  await inline.click()
  await page.keyboard.press('Control+End')
  if (await inline.textContent()) await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await page.getByRole('option', { name: /^Embed/ }).click()
  const embeds = editor.getByTestId('note-embed-block')
  const embed = embeds.last()
  await expect(embed.getByText('Drag and drop a resource or file here')).toBeVisible()
  return embed
}
