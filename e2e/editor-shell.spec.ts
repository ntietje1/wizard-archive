import { expect, test } from '@playwright/test'

test.describe('editor shell', () => {
  test('navigates resources and preserves workspace controls', async ({ page }) => {
    await page.goto('/demo?scenario=campaign-home', { waitUntil: 'commit' })

    const workspace = page.getByRole('region', { name: 'Demo workspace' })
    await expect(workspace).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible()

    await page.getByRole('button', { name: 'The Lantern Market' }).click()
    await expect(page.getByRole('heading', { name: 'The Lantern Market' })).toBeVisible()
    await expect(page.getByLabel('Note content')).toBeVisible()

    await page.getByRole('button', { name: 'Open resource panel' }).click()
    await expect(page.getByRole('complementary', { name: 'Resource panel' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()

    await page.getByRole('button', { name: 'Viewer' }).click()
    await expect(page.getByText('Viewer mode — editing is disabled')).toBeVisible()

    if (process.env.WA_VISUAL_QA_PATH) {
      await page.screenshot({ path: process.env.WA_VISUAL_QA_PATH })
    }
  })
})
