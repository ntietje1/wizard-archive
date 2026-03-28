import { expect, test } from '@playwright/test'

test('open settings from user menu', async ({ page }) => {
  await page.goto('/campaigns')
  await page.getByRole('button', { name: /user|avatar|menu/i }).click()
  await page.getByText(/settings/i).click()
  await expect(page).toHaveURL(/\/settings/)
})

test('theme toggle changes html class', async ({ page }) => {
  await page.goto('/settings')
  const themeToggle = page.getByRole('button', { name: /theme|dark|light/i })
  await expect(themeToggle).toBeVisible()

  const initialClass = await page.locator('html').getAttribute('class')
  await themeToggle.click()
  const newClass = await page.locator('html').getAttribute('class')
  expect(newClass).not.toEqual(initialClass)
})
