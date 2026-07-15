import { expect, test } from '@playwright/test'

test.describe('editor shell', () => {
  test('navigates resources and preserves workspace controls', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })

    const workspace = page.getByRole('region', { name: 'Demo workspace' })
    await expect(workspace).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible({ timeout: 10_000 })

    const invoice = page.getByRole('button', { name: 'Blue-glass Invoice' })
    const canvas = page.getByRole('button', { name: 'Harbor Heist Board' })
    const map = page.getByRole('button', { name: 'Moonwell Docks' })
    await invoice.click()
    await canvas.click({ modifiers: ['Control'] })
    await map.click({ modifiers: ['Shift'] })
    await expect(invoice).toHaveAttribute('data-selected', 'true')
    await expect(canvas).toHaveAttribute('data-selected', 'true')
    await expect(map).toHaveAttribute('data-selected', 'true')
    await invoice.click({ button: 'right' })
    await expect(page.getByRole('menu', { name: 'Blue-glass Invoice actions' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy 3 items' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Create resource' }).click()
    await page.getByRole('textbox', { name: 'New resource title' }).fill('Drop destination')
    await page.getByRole('menuitem', { name: 'Folder' }).click()
    const destination = page.getByRole('button', { name: 'Drop destination', exact: true })
    await expect(destination).toBeVisible()
    await expect(invoice).toHaveAttribute('draggable', 'true')
    await invoice.dragTo(destination)
    await expect(page.getByRole('status')).toContainText('Completed')

    await page.getByRole('button', { name: 'The Lantern Market' }).click()
    await expect(page.getByRole('heading', { name: 'The Lantern Market' })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'The Lantern Market note editor' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await expect(page.getByRole('complementary', { name: 'Resource panel' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()

    await page.getByRole('button', { name: 'Viewer' }).click()
    await expect(page.getByText('Viewer mode — editing is disabled')).toBeVisible()

    if (process.env.WA_VISUAL_QA_PATH) {
      await page.screenshot({ path: process.env.WA_VISUAL_QA_PATH })
    }
  })

  test('projects note headings into the live outline', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'The Lantern Market' }).click()
    const editor = page.getByRole('textbox', { name: 'The Lantern Market note editor' })
    await expect(editor).toBeVisible()

    await editor.click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await page.getByRole('option', { name: /^Heading 2/ }).click()
    await page.keyboard.type('Dockside clues')

    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await page.getByRole('button', { name: 'Outline' }).click()
    const outline = page.getByRole('navigation', { name: 'Note outline' })
    await expect(outline.getByRole('button', { name: 'Dockside clues' })).toBeVisible()
  })
})
